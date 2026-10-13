"""
app/api/cp_sql_routes.py
========================
CP Dashboard endpoints backed by the custom JWT auth system + SQLAlchemy.

These routes are ADDITIVE — they do not modify the existing Supabase-backed
cp_routes.py, agents, sandbox, or SSE streaming code.

Endpoints
---------
  POST /api/v1/cp2/sync-handles   – save handles + trigger live sync
  GET  /api/v1/cp2/dashboard-stats – return cached stats + analytics from DB
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func as sa_func, distinct, cast, Date
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.core.models import CPProfile, CPSubmission, CPProfileSnapshot, User
from backend.services.cp_sync_sql import normalize_platform_handle, normalize_topic, sync_all_profiles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cp2", tags=["CP Dashboard (JWT Auth)"])

# ── Request / response schemas ────────────────────────────────────────────────

class SyncHandlesRequest(BaseModel):
    leetcode_handle:   Optional[str] = Field(default=None, max_length=200)
    codeforces_handle: Optional[str] = Field(default=None, max_length=200)
    codechef_handle:   Optional[str] = Field(default=None, max_length=200)


# ── Helper ─────────────────────────────────────────────────────────────────────

def _cp_profile_to_dict(cp: CPProfile) -> Dict[str, Any]:
    """Serialise a CPProfile ORM row to a frontend-ready dict.

    IMPORTANT: Only includes real, verified difficulty data.
    - LeetCode: easy/medium/hard from GraphQL API (reliable)
    - Codeforces: difficulty classification NOT available from user.info API
    - CodeChef: difficulty classification NOT available from scraper
    """
    lc_total = (cp.lc_easy_solved or 0) + (cp.lc_medium_solved or 0) + (cp.lc_hard_solved or 0)

    return {
        "handles": {
            "leetcode":   cp.leetcode_handle,
            "codeforces": cp.codeforces_handle,
            "codechef":   cp.codechef_handle,
        },
        "leetcode": {
            "platform":      "leetcode",
            "handle":        cp.leetcode_handle or "",
            "rating":        cp.lc_rating,
            "max_rating":    cp.lc_rating,
            "rank":          cp.lc_rank or "",
            "easy_solved":   cp.lc_easy_solved,
            "medium_solved": cp.lc_medium_solved,
            "hard_solved":   cp.lc_hard_solved,
            "total_solved":  lc_total,
        },
        "codeforces": {
            "platform":      "codeforces",
            "handle":        cp.codeforces_handle or "",
            "rating":        cp.cf_rating,
            "max_rating":    cp.cf_max_rating,
            "rank":          cp.cf_rank or "",
            # Codeforces API does not provide per-difficulty classification
            "easy_solved":   None,
            "medium_solved": None,
            "hard_solved":   None,
            "total_solved":  None,  # Computed from submissions in analytics
        },
        "codechef": {
            "platform":      "codechef",
            "handle":        cp.codechef_handle or "",
            "rating":        cp.cc_rating,
            "max_rating":    cp.cc_max_rating,
            "rank":          cp.cc_stars or "",
            "stars":         cp.cc_stars or "",
            # CodeChef scraper does not provide per-difficulty breakdown
            "easy_solved":   None,
            "medium_solved": None,
            "hard_solved":   None,
            "total_solved":  cp.cc_total_solved if cp.cc_total_solved is not None else None,
            "error":         None,
        },
        "totals": {
            # Only include verified difficulty data (LeetCode only)
            "easy":   cp.lc_easy_solved or 0,
            "medium": cp.lc_medium_solved or 0,
            "hard":   cp.lc_hard_solved or 0,
            "total":  lc_total + (cp.cc_total_solved or 0),
            "classified_total": lc_total,
            "unclassified_note": (
                "Only LeetCode provides verified difficulty classifications. "
                "Codeforces and CodeChef totals are excluded from the difficulty breakdown."
            ),
        },
        "last_synced_at": cp.last_synced_at.isoformat() if cp.last_synced_at else None,
    }


def _normalize_submitted_handle(platform: str, value: str | None) -> str | None:
    if value is None:
        return None
    if not value.strip():
        return None
    normalized = normalize_platform_handle(platform, value)
    if normalized is None:
        label = {"leetcode": "LeetCode", "codeforces": "Codeforces", "codechef": "CodeChef"}.get(platform, platform)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label} handle or profile URL.",
        )
    return normalized


# ── Analytics query helpers ───────────────────────────────────────────────────

def _get_topics(db: Session, email: str) -> List[Dict[str, Any]]:
    """Aggregate distinct solved problems by normalized topic across platforms.

    Only includes accepted submissions with topic tags.
    One problem may have multiple topics, so topic totals can exceed unique-problem count.
    """
    submissions = (
        db.query(CPSubmission.platform, CPSubmission.problem_id, CPSubmission.topics_csv)
        .filter(
            CPSubmission.user_email == email,
            CPSubmission.is_accepted == True,
            CPSubmission.topics_csv != None,
            CPSubmission.topics_csv != "",
        )
        .all()
    )

    # Deduplicate: (platform, problem_id) → set of topics
    problem_topics: Dict[tuple, set] = {}
    for platform, problem_id, topics_csv in submissions:
        key = (platform, problem_id)
        if key not in problem_topics:
            problem_topics[key] = set()
        for raw_tag in topics_csv.split(","):
            tag = raw_tag.strip()
            if tag:
                problem_topics[key].add(normalize_topic(tag))

    # Count distinct problems per topic
    topic_counts: Dict[str, int] = defaultdict(int)
    contributing_platforms = set()
    for (platform, _), topics in problem_topics.items():
        contributing_platforms.add(platform)
        for topic in topics:
            topic_counts[topic] += 1

    # Sort by count descending
    sorted_topics = sorted(topic_counts.items(), key=lambda x: -x[1])

    return {
        "topics": [{"topic": t, "count": c} for t, c in sorted_topics],
        "contributing_platforms": sorted(contributing_platforms),
        "note": (
            "One problem may have multiple topic tags, so topic totals can exceed "
            "the unique-problem total. Only platforms with available topic data contribute."
        ),
    }


def _get_daily_activity(db: Session, email: str, days: int = 365) -> List[Dict[str, Any]]:
    """Get daily activity (distinct problems solved per day) for the heatmap.

    Uses the earliest accepted submission per (platform, problem_id) as the
    first-solve date. Deduplicates across submissions of the same problem.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Get first accepted submission date per (platform, problem_id)
    first_solves = (
        db.query(
            cast(sa_func.min(CPSubmission.submitted_at), Date).label("solve_date"),
            CPSubmission.platform,
            CPSubmission.problem_id,
        )
        .filter(
            CPSubmission.user_email == email,
            CPSubmission.is_accepted == True,
            CPSubmission.submitted_at != None,
            CPSubmission.submitted_at >= cutoff,
        )
        .group_by(CPSubmission.platform, CPSubmission.problem_id)
        .all()
    )

    # Count distinct problems per date
    date_counts: Dict[str, int] = defaultdict(int)
    for solve_date, platform, problem_id in first_solves:
        if solve_date:
            date_str = solve_date.isoformat() if isinstance(solve_date, date) else str(solve_date)[:10]
            date_counts[date_str] += 1

    # Build full date range
    result = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        date_str = d.isoformat()
        result.append({
            "date": date_str,
            "count": date_counts.get(date_str, 0),
        })

    return result


def _get_daily_progress(db: Session, email: str, days: int = 90) -> Dict[str, Any]:
    """Get daily progress with daily solved and cumulative solved counts.

    Uses first-solve dates from submission history.
    Cumulative counts represent growth since tracking began, not all-time totals.
    """
    # Get ALL first-solve dates (not just recent ones) for cumulative calculation
    first_solves = (
        db.query(
            cast(sa_func.min(CPSubmission.submitted_at), Date).label("solve_date"),
            CPSubmission.platform,
            CPSubmission.problem_id,
        )
        .filter(
            CPSubmission.user_email == email,
            CPSubmission.is_accepted == True,
            CPSubmission.submitted_at != None,
        )
        .group_by(CPSubmission.platform, CPSubmission.problem_id)
        .all()
    )

    # Count per date
    all_date_counts: Dict[str, int] = defaultdict(int)
    for solve_date, platform, problem_id in first_solves:
        if solve_date:
            date_str = solve_date.isoformat() if isinstance(solve_date, date) else str(solve_date)[:10]
            all_date_counts[date_str] += 1

    # Build result for requested range
    today = date.today()
    start_date = today - timedelta(days=days - 1)

    # Calculate cumulative total before the start date
    cumulative = 0
    for date_str, count in sorted(all_date_counts.items()):
        if date_str < start_date.isoformat():
            cumulative += count

    result = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        date_str = d.isoformat()
        daily = all_date_counts.get(date_str, 0)
        cumulative += daily
        result.append({
            "date": date_str,
            "daily_solved": daily,
            "cumulative_solved": cumulative,
        })

    # Find available date range
    all_dates = sorted(all_date_counts.keys())
    earliest = all_dates[0] if all_dates else None
    latest = all_dates[-1] if all_dates else None

    return {
        "progress": result,
        "range_days": days,
        "earliest_record": earliest,
        "latest_record": latest,
        "note": (
            "Cumulative solved represents distinct problems first solved since tracking began. "
            "It may not reflect all-time totals if historical data predates tracking."
        ),
    }


def _get_cf_total_solved(db: Session, email: str) -> Optional[int]:
    """Get Codeforces total solved from stored accepted submissions."""
    count = (
        db.query(sa_func.count(distinct(CPSubmission.problem_id)))
        .filter(
            CPSubmission.user_email == email,
            CPSubmission.platform == "codeforces",
            CPSubmission.is_accepted == True,
        )
        .scalar()
    )
    return count if count and count > 0 else None


def _get_data_coverage(db: Session, email: str) -> Dict[str, Any]:
    """Report which platforms have submission/topic data available."""
    platforms = (
        db.query(
            CPSubmission.platform,
            sa_func.count(distinct(CPSubmission.problem_id)).label("unique_problems"),
            sa_func.count(CPSubmission.id).label("total_submissions"),
        )
        .filter(
            CPSubmission.user_email == email,
            CPSubmission.is_accepted == True,
        )
        .group_by(CPSubmission.platform)
        .all()
    )

    coverage = {}
    for platform, unique_problems, total_submissions in platforms:
        # Check if topics are available for this platform
        topic_count = (
            db.query(sa_func.count(distinct(CPSubmission.problem_id)))
            .filter(
                CPSubmission.user_email == email,
                CPSubmission.platform == platform,
                CPSubmission.is_accepted == True,
                CPSubmission.topics_csv != None,
                CPSubmission.topics_csv != "",
            )
            .scalar()
        ) or 0

        coverage[platform] = {
            "has_submissions": True,
            "unique_accepted": unique_problems,
            "total_submissions": total_submissions,
            "has_topics": topic_count > 0,
            "problems_with_topics": topic_count,
        }

    return coverage


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post(
    "/sync-handles",
    summary="Save handles and trigger live CP sync",
    status_code=status.HTTP_200_OK,
)
async def sync_handles(
    payload:      SyncHandlesRequest,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    1. Persist the submitted platform handles to CPProfile.
    2. Trigger async parallel fetchers (LeetCode, Codeforces, CodeChef).
    3. Update CPProfile with fresh stats.
    4. Return normalised stats JSON.
    """
    cp: Optional[CPProfile] = (
        db.query(CPProfile)
        .filter(CPProfile.user_email == current_user.email)
        .first()
    )
    if cp is None:
        cp = CPProfile(user_email=current_user.email)
        db.add(cp)

    # Persist handles (sanitise URLs → raw usernames)
    if payload.leetcode_handle is not None:
        cp.leetcode_handle = _normalize_submitted_handle("leetcode", payload.leetcode_handle)
    if payload.codeforces_handle is not None:
        cp.codeforces_handle = _normalize_submitted_handle("codeforces", payload.codeforces_handle)
    if payload.codechef_handle is not None:
        cp.codechef_handle = _normalize_submitted_handle("codechef", payload.codechef_handle)

    db.commit()
    db.refresh(cp)

    if not any([cp.leetcode_handle, cp.codeforces_handle, cp.codechef_handle]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one platform handle.",
        )

    try:
        result = await sync_all_profiles(email=current_user.email, db=db)
    except Exception as exc:
        logger.error("sync_all_profiles failed for %s: %s", current_user.email, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sync error: {exc}",
        )

    return result


@router.get(
    "/dashboard-stats",
    summary="Return cached CP stats + analytics from DB",
)
def dashboard_stats(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
    activity_days: int    = Query(default=365, ge=30, le=730, description="Days of activity history"),
    progress_days: int    = Query(default=90, ge=7, le=365, description="Days of progress data"),
) -> Dict[str, Any]:
    """Return the last-synced stats + analytics without triggering a live fetch."""
    cp: Optional[CPProfile] = (
        db.query(CPProfile)
        .filter(CPProfile.user_email == current_user.email)
        .first()
    )
    if cp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No CP profile found. Register first.",
        )

    # Base profile data
    profile_data = _cp_profile_to_dict(cp)

    # Enhance Codeforces total_solved from submissions
    cf_total = _get_cf_total_solved(db, current_user.email)
    if cf_total is not None:
        profile_data["codeforces"]["total_solved"] = cf_total
        # Update grand total
        lc_total = profile_data["leetcode"]["total_solved"] or 0
        cc_total = profile_data["codechef"]["total_solved"] or 0
        profile_data["totals"]["total"] = lc_total + cf_total + cc_total

    # Analytics data
    topics_data = _get_topics(db, current_user.email)
    daily_activity = _get_daily_activity(db, current_user.email, days=activity_days)
    daily_progress = _get_daily_progress(db, current_user.email, days=progress_days)
    data_coverage = _get_data_coverage(db, current_user.email)

    return {
        "user": {
            "email": current_user.email,
            "name":  current_user.name,
        },
        **profile_data,
        "topics": topics_data,
        "daily_activity": daily_activity,
        "daily_progress": daily_progress,
        "data_coverage": data_coverage,
    }
