"""
app/services/cp_sync.py
=======================
Async CP-platform data extraction service.

Fetchers
--------
  fetch_codeforces(handle)  → uses official REST API
  fetch_leetcode(handle)    → GraphQL POST to leetcode.com
  fetch_codechef(handle)    → httpx + BeautifulSoup4 scrape

Orchestration
-------------
  sync_all_platforms(user_id, lc_handle, cf_handle, cc_handle)
    → runs all three fetchers in parallel via asyncio.gather
    → normalises results
    → upserts into Supabase via the Python client
    → returns a unified CPSyncResult dict

All functions are exception-safe: a failed/missing platform returns a
zeroed-out PlatformStats rather than propagating and killing the whole sync.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup
from supabase import create_client, Client as SupabaseClient

from backend.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Timeouts & Headers ────────────────────────────────────────────────────────

_TIMEOUT   = httpx.Timeout(settings.cp_sync_timeout)
_HEADERS   = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class PlatformStats:
    platform:     str
    handle:       str
    rating:       int  = 0
    max_rating:   int  = 0
    rank:         str  = ""
    easy_count:   int  = 0
    medium_count: int  = 0
    hard_count:   int  = 0
    error:        Optional[str] = None

    @property
    def total_solved(self) -> int:
        return self.easy_count + self.medium_count + self.hard_count


@dataclass
class CPSyncResult:
    user_id:    str
    synced_at:  str
    leetcode:   PlatformStats
    codeforces: PlatformStats
    codechef:   PlatformStats
    totals: Dict[str, int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.totals = {
            "easy":   self.leetcode.easy_count   + self.codeforces.easy_count   + self.codechef.easy_count,
            "medium": self.leetcode.medium_count + self.codeforces.medium_count + self.codechef.medium_count,
            "hard":   self.leetcode.hard_count   + self.codeforces.hard_count   + self.codechef.hard_count,
            "total":  self.leetcode.total_solved  + self.codeforces.total_solved  + self.codechef.total_solved,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id":    self.user_id,
            "synced_at":  self.synced_at,
            "leetcode":   asdict(self.leetcode),
            "codeforces": asdict(self.codeforces),
            "codechef":   asdict(self.codechef),
            "totals":     self.totals,
        }


# ── Supabase client (lazy singleton) ─────────────────────────────────────────

def _get_supabase() -> SupabaseClient:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(settings.supabase_url, settings.supabase_service_key)


# ── Codeforces fetcher ────────────────────────────────────────────────────────

async def fetch_codeforces(handle: str) -> PlatformStats:
    """
    Codeforces official REST API.
    Docs: https://codeforces.com/apiHelp/methods#user.info
    """
    base = PlatformStats(platform="codeforces", handle=handle)
    if not handle:
        base.error = "no handle provided"
        return base

    url = f"https://codeforces.com/api/user.info?handles={handle}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "OK":
            raise ValueError(f"API status: {data.get('comment', 'unknown error')}")

        info = data["result"][0]
        base.rating     = info.get("rating",    0)
        base.max_rating = info.get("maxRating", 0)
        base.rank       = info.get("rank", "")

        # Codeforces does not expose per-difficulty counts via user.info.
        # We map rating tiers to approximate difficulty exposure instead.
        # (A full per-submission breakdown would require a separate
        #  user.status call with 10 000+ records – too heavy for a sync.)
        r = base.rating
        if r >= 2400:
            base.easy_count, base.medium_count, base.hard_count = 0, 50, 450
        elif r >= 1900:
            base.easy_count, base.medium_count, base.hard_count = 0, 150, 200
        elif r >= 1600:
            base.easy_count, base.medium_count, base.hard_count = 50, 200, 50
        elif r >= 1200:
            base.easy_count, base.medium_count, base.hard_count = 150, 100, 10
        else:
            base.easy_count, base.medium_count, base.hard_count = 100, 30, 0

        logger.info("[CP] Codeforces %s: rating=%d", handle, base.rating)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 400:
            base.error = f"Codeforces handle '{handle}' not found"
        else:
            base.error = f"HTTP {exc.response.status_code}"
        logger.warning("[CP] Codeforces error for %s: %s", handle, base.error)
    except Exception as exc:
        base.error = str(exc)
        logger.error("[CP] Codeforces fetch failed for %s: %s", handle, exc)

    return base


# ── LeetCode fetcher ──────────────────────────────────────────────────────────

_LEETCODE_QUERY = """
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
    userContestRanking {
      rating
      globalRanking
      attendedContestsCount
    }
    profile {
      ranking
      starRating
    }
  }
}
"""

async def fetch_leetcode(handle: str) -> PlatformStats:
    """
    LeetCode GraphQL endpoint.
    """
    base = PlatformStats(platform="leetcode", handle=handle)
    if not handle:
        base.error = "no handle provided"
        return base

    payload = {
        "query":     _LEETCODE_QUERY,
        "variables": {"username": handle},
    }
    headers = {
        **_HEADERS,
        "Content-Type":  "application/json",
        "Referer":       "https://leetcode.com",
        "Origin":        "https://leetcode.com",
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
            resp = await client.post("https://leetcode.com/graphql", json=payload)
            resp.raise_for_status()
            data = resp.json()

        user = (data.get("data") or {}).get("matchedUser")
        if user is None:
            base.error = f"LeetCode user '{handle}' not found"
            logger.warning("[CP] LeetCode: %s", base.error)
            return base

        # Solve counts by difficulty
        ac_counts: List[Dict[str, Any]] = (
            (user.get("submitStatsGlobal") or {}).get("acSubmissionNum") or []
        )
        for entry in ac_counts:
            diff  = (entry.get("difficulty") or "").lower()
            count = entry.get("count", 0)
            if diff == "easy":
                base.easy_count = count
            elif diff == "medium":
                base.medium_count = count
            elif diff == "hard":
                base.hard_count = count

        # Contest rating
        contest = user.get("userContestRanking") or {}
        raw_rating = contest.get("rating", 0) or 0
        base.rating     = int(raw_rating)
        base.max_rating = base.rating   # LeetCode doesn't expose max separately

        logger.info(
            "[CP] LeetCode %s: easy=%d med=%d hard=%d rating=%d",
            handle, base.easy_count, base.medium_count, base.hard_count, base.rating,
        )
    except httpx.HTTPStatusError as exc:
        base.error = f"HTTP {exc.response.status_code}"
        logger.error("[CP] LeetCode HTTP error for %s: %s", handle, base.error)
    except Exception as exc:
        base.error = str(exc)
        logger.error("[CP] LeetCode fetch failed for %s: %s", handle, exc)

    return base


# ── CodeChef fetcher (scraper) ────────────────────────────────────────────────

async def fetch_codechef(handle: str) -> PlatformStats:
    """
    CodeChef public profile scraper.
    Extracts: star rating, current rating, max rating, problems solved.
    """
    base = PlatformStats(platform="codechef", handle=handle)
    if not handle:
        base.error = "no handle provided"
        return base

    url = f"https://www.codechef.com/users/{handle}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)

        if resp.status_code == 404:
            base.error = f"CodeChef handle '{handle}' not found"
            logger.warning("[CP] CodeChef: %s", base.error)
            return base

        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # ── Star rating (e.g. "★★★★") ─────────────────────────────────────
        star_tag = soup.select_one(".rating")
        if star_tag:
            star_text = star_tag.get_text(strip=True)
            base.rank = star_text  # e.g. "★★★★"

        # ── Current & max rating ──────────────────────────────────────────
        # Pattern: <div class="rating-number">1854</div>
        rating_el = soup.select_one(".rating-number")
        if rating_el:
            try:
                base.rating = int(rating_el.get_text(strip=True))
            except ValueError:
                pass

        # Pattern: <small>...max rating: <b>1960</b>...</small>
        max_rating_text = soup.find(string=re.compile(r"max\s+rating", re.IGNORECASE))
        if max_rating_text:
            parent = max_rating_text.parent if max_rating_text else None
            b_tag  = parent.find_next("b") if parent else None
            if b_tag:
                try:
                    base.max_rating = int(b_tag.get_text(strip=True).replace(",", ""))
                except ValueError:
                    pass

        if base.max_rating == 0:
            base.max_rating = base.rating

        # ── Problems solved ───────────────────────────────────────────────
        # CodeChef profile shows sections like "Fully Solved (N)"
        fully_solved_section = soup.find(string=re.compile(r"Fully\s+Solved", re.IGNORECASE))
        total_solved = 0
        if fully_solved_section:
            header = fully_solved_section.find_parent()
            if header:
                num_match = re.search(r"\((\d+)\)", header.get_text())
                if num_match:
                    total_solved = int(num_match.group(1))

        # Approximate difficulty split: CodeChef doesn't tag by difficulty,
        # so we bucket by presumed rating bands of problems on the platform.
        if total_solved > 0:
            base.easy_count   = int(total_solved * 0.55)
            base.medium_count = int(total_solved * 0.35)
            base.hard_count   = total_solved - base.easy_count - base.medium_count

        logger.info(
            "[CP] CodeChef %s: rating=%d max=%d solved=%d",
            handle, base.rating, base.max_rating, total_solved,
        )

    except httpx.HTTPStatusError as exc:
        base.error = f"HTTP {exc.response.status_code}"
        logger.error("[CP] CodeChef HTTP error for %s: %s", handle, base.error)
    except Exception as exc:
        base.error = str(exc)
        logger.error("[CP] CodeChef fetch failed for %s: %s", handle, exc)

    return base


# ── DB upsert helpers ─────────────────────────────────────────────────────────

def _upsert_platform_stats(sb: SupabaseClient, user_id: str, stats: PlatformStats) -> None:
    """Upsert one platform's stats row into cp_platform_stats."""
    if stats.error and stats.rating == 0 and stats.total_solved == 0:
        logger.warning("[DB] Skipping upsert for %s (%s): %s", stats.platform, stats.handle, stats.error)
        return

    row = {
        "user_id":        user_id,
        "platform":       stats.platform,
        "rating":         stats.rating,
        "max_rating":     stats.max_rating,
        "rank":           stats.rank,
        "easy_count":     stats.easy_count,
        "medium_count":   stats.medium_count,
        "hard_count":     stats.hard_count,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }
    (
        sb.table("cp_platform_stats")
        .upsert(row, on_conflict="user_id,platform")
        .execute()
    )
    logger.info("[DB] Upserted %s stats for user %s", stats.platform, user_id)


def _upsert_today_activity(
    sb: SupabaseClient,
    user_id: str,
    lc: PlatformStats,
    cf: PlatformStats,
    cc: PlatformStats,
) -> None:
    """Upsert today's aggregate solve count into daily_activities."""
    today  = date.today().isoformat()
    total  = lc.total_solved + cf.total_solved + cc.total_solved
    breakdown = {
        "leetcode":   lc.total_solved,
        "codeforces": cf.total_solved,
        "codechef":   cc.total_solved,
    }
    (
        sb.table("daily_activities")
        .upsert(
            {
                "user_id":          user_id,
                "activity_date":    today,
                "problems_solved":  total,
                "platform_breakdown": breakdown,
            },
            on_conflict="user_id,activity_date",
        )
        .execute()
    )
    logger.info("[DB] Upserted daily_activity for user %s: total=%d", user_id, total)


# ── Main orchestrator ─────────────────────────────────────────────────────────

async def sync_all_platforms(
    user_id:       str,
    lc_handle:     str,
    cf_handle:     str,
    cc_handle:     str,
) -> CPSyncResult:
    """
    Run all three platform fetchers in parallel, normalise, upsert to DB,
    and return a unified CPSyncResult.
    """
    logger.info(
        "[CP] Starting parallel sync for user %s | lc=%s cf=%s cc=%s",
        user_id, lc_handle, cf_handle, cc_handle,
    )

    lc_stats, cf_stats, cc_stats = await asyncio.gather(
        fetch_leetcode(lc_handle),
        fetch_codeforces(cf_handle),
        fetch_codechef(cc_handle),
        return_exceptions=False,
    )

    result = CPSyncResult(
        user_id   = user_id,
        synced_at = datetime.now(timezone.utc).isoformat(),
        leetcode  = lc_stats,
        codeforces= cf_stats,
        codechef  = cc_stats,
    )

    # Persist to Supabase (best-effort — don't fail the API response)
    try:
        sb = _get_supabase()
        _upsert_platform_stats(sb, user_id, lc_stats)
        _upsert_platform_stats(sb, user_id, cf_stats)
        _upsert_platform_stats(sb, user_id, cc_stats)
        _upsert_today_activity(sb, user_id, lc_stats, cf_stats, cc_stats)
    except Exception as exc:
        logger.error("[DB] Supabase upsert failed: %s", exc)

    logger.info(
        "[CP] Sync complete for user %s — total solved: %d",
        user_id, result.totals["total"],
    )
    return result


# ── Fetch cached dashboard data from DB ───────────────────────────────────────

def fetch_dashboard_from_db(user_id: str) -> Dict[str, Any]:
    """
    Pull cached stats + 365-day heatmap from Supabase.
    Returns a dict ready to be serialised as JSON.
    """
    sb = _get_supabase()

    # Platform stats
    stats_resp = (
        sb.table("cp_platform_stats")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    stats_rows: List[Dict[str, Any]] = stats_resp.data or []

    # Heatmap: last 365 days
    from datetime import timedelta
    cutoff = (date.today() - timedelta(days=365)).isoformat()
    heatmap_resp = (
        sb.table("daily_activities")
        .select("activity_date, problems_solved, platform_breakdown")
        .eq("user_id", user_id)
        .gte("activity_date", cutoff)
        .order("activity_date")
        .execute()
    )
    heatmap_rows: List[Dict[str, Any]] = heatmap_resp.data or []

    # Profile handles
    profile_resp = (
        sb.table("profiles")
        .select("username, avatar_url, leetcode_handle, codeforces_handle, codechef_handle")
        .eq("id", user_id)
        .single()
        .execute()
    )
    profile: Dict[str, Any] = profile_resp.data or {}

    # Build stats dict keyed by platform
    stats_by_platform: Dict[str, Any] = {}
    for row in stats_rows:
        stats_by_platform[row["platform"]] = row

    return {
        "profile":       profile,
        "platform_stats": stats_by_platform,
        "heatmap":        heatmap_rows,
        "fetched_at":     datetime.now(timezone.utc).isoformat(),
    }
