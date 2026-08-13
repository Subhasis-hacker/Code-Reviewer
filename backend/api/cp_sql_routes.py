"""
app/api/cp_sql_routes.py
========================
CP Dashboard endpoints backed by the custom JWT auth system + SQLAlchemy.

These routes are ADDITIVE — they do not modify the existing Supabase-backed
cp_routes.py, agents, sandbox, or SSE streaming code.

Endpoints
---------
  POST /api/v1/cp2/sync-handles   – save handles + trigger live sync
  GET  /api/v1/cp2/dashboard-stats – return cached stats from DB
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.core.models import CPProfile, User
from backend.services.cp_sync_sql import sync_all_profiles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cp2", tags=["CP Dashboard (JWT Auth)"])


# ── Request / response schemas ────────────────────────────────────────────────

class SyncHandlesRequest(BaseModel):
    leetcode_handle:   Optional[str] = Field(default=None, max_length=80)
    codeforces_handle: Optional[str] = Field(default=None, max_length=80)
    codechef_handle:   Optional[str] = Field(default=None, max_length=80)


# ── Helper ─────────────────────────────────────────────────────────────────────

def _cp_profile_to_dict(cp: CPProfile) -> Dict[str, Any]:
    """Serialise a CPProfile ORM row to a frontend-ready dict."""
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
            "total_solved":  (cp.lc_easy_solved or 0) + (cp.lc_medium_solved or 0) + (cp.lc_hard_solved or 0),
        },
        "codeforces": {
            "platform":      "codeforces",
            "handle":        cp.codeforces_handle or "",
            "rating":        cp.cf_rating,
            "max_rating":    cp.cf_max_rating,
            "rank":          cp.cf_rank or "",
            "easy_solved":   0,
            "medium_solved": 0,
            "hard_solved":   0,
            "total_solved":  0,
        },
        "codechef": {
            "platform":      "codechef",
            "handle":        cp.codechef_handle or "",
            "rating":        cp.cc_rating,
            "max_rating":    cp.cc_max_rating,
            "rank":          cp.cc_stars or "",
            "easy_solved":   int((cp.cc_total_solved or 0) * 0.55),
            "medium_solved": int((cp.cc_total_solved or 0) * 0.35),
            "hard_solved":   (cp.cc_total_solved or 0) - int((cp.cc_total_solved or 0) * 0.55) - int((cp.cc_total_solved or 0) * 0.35),
            "total_solved":  cp.cc_total_solved or 0,
        },
        "totals": {
            "easy":   (cp.lc_easy_solved or 0) + int((cp.cc_total_solved or 0) * 0.55),
            "medium": (cp.lc_medium_solved or 0) + int((cp.cc_total_solved or 0) * 0.35),
            "hard":   (cp.lc_hard_solved or 0) + (
                (cp.cc_total_solved or 0) - int((cp.cc_total_solved or 0) * 0.55) - int((cp.cc_total_solved or 0) * 0.35)
            ),
            "total":  (
                (cp.lc_easy_solved or 0) + (cp.lc_medium_solved or 0) + (cp.lc_hard_solved or 0)
                + (cp.cc_total_solved or 0)
            ),
        },
        "last_synced_at": cp.last_synced_at.isoformat() if cp.last_synced_at else None,
    }


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

    # Persist handles
    if payload.leetcode_handle is not None:
        cp.leetcode_handle   = payload.leetcode_handle.strip()   or None
    if payload.codeforces_handle is not None:
        cp.codeforces_handle = payload.codeforces_handle.strip() or None
    if payload.codechef_handle is not None:
        cp.codechef_handle   = payload.codechef_handle.strip()   or None

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
    summary="Return cached CP stats from DB",
)
def dashboard_stats(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return the last-synced stats without triggering a live fetch."""
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

    return {
        "user": {
            "email": current_user.email,
            "name":  current_user.name,
        },
        **_cp_profile_to_dict(cp),
    }