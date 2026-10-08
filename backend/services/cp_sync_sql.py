"""
app/services/cp_sync_sql.py
============================
CP-platform data extraction + SQLAlchemy persistence.

This is the SQLAlchemy-backed version used by the custom-JWT auth routes.
It does NOT replace app/services/cp_sync.py (Supabase version) — both coexist.

Fetchers (async httpx)
----------------------
  fetch_leetcode(handle)    → GraphQL POST to leetcode.com
  fetch_codeforces(handle)  → Official Codeforces REST API
  fetch_codechef(handle)    → httpx + BeautifulSoup4 scraper

Orchestrator
------------
  sync_all_profiles(email, db)
    → reads handles from CPProfile
    → runs all fetchers in parallel
    → updates CPProfile row in PostgreSQL
    → returns normalised dict for the API response
"""

from __future__ import annotations
import asyncio
import logging
import re
from datetime import datetime, timezone
from json import JSONDecodeError
from typing import Any, Dict, Optional
from urllib.parse import unquote, urlparse
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from backend.core.models import CPProfile

logger = logging.getLogger(__name__)

# ── URL / username sanitisation ────────────────────────────────────────────────

_PLATFORM_URLS = {
    "leetcode": {
        "hosts": {"leetcode.com", "www.leetcode.com"},
        "prefixes": {"u", "users"},
    },
    "codeforces": {
        "hosts": {"codeforces.com", "www.codeforces.com"},
        "prefixes": {"profile"},
    },
    "codechef": {
        "hosts": {"codechef.com", "www.codechef.com"},
        "prefixes": {"users"},
    },
}
_PLAIN_HANDLE_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def normalize_platform_handle(platform: str, handle: str | None) -> str | None:
    """Return a platform username from a profile URL or plain handle.

    Examples
    --------
    >>> normalize_platform_handle("leetcode", "https://leetcode.com/u/Subhasis_Jena/")
    'Subhasis_Jena'
    >>> normalize_platform_handle("leetcode", "https://leetcode.com/u/Subhasis_Jena")
    'Subhasis_Jena'
    >>> normalize_platform_handle("codeforces", "https://codeforces.com/profile/J_U_J_U_08")
    'J_U_J_U_08'
    >>> normalize_platform_handle("codechef", "https://www.codechef.com/users/Subhasis_cc")
    'Subhasis_cc'
    >>> normalize_platform_handle("leetcode", "Subhasis_Jena")
    'Subhasis_Jena'
    >>> normalize_platform_handle("leetcode", "https://example.com/test") is None
    True
    >>> normalize_platform_handle("leetcode", None) is None
    True
    >>> normalize_platform_handle("leetcode", "") is None
    True
    """
    if not handle:
        return None

    text = handle.strip()
    if not text:
        return None

    platform_key = platform.lower()
    cfg = _PLATFORM_URLS.get(platform_key)
    if not cfg:
        return text if _PLAIN_HANDLE_RE.fullmatch(text) else None

    parsed = urlparse(text)
    if parsed.scheme or parsed.netloc:
        if parsed.scheme not in {"http", "https"}:
            return None
        host = parsed.netloc.lower()
        if host not in cfg["hosts"]:
            return None
        parts = [unquote(part) for part in parsed.path.split("/") if part]
        if len(parts) != 2 or parts[0].lower() not in cfg["prefixes"]:
            return None
        username = parts[1].strip()
        return username if _PLAIN_HANDLE_RE.fullmatch(username) else None

    if any(ch in text for ch in "/?#") or not _PLAIN_HANDLE_RE.fullmatch(text):
        return None

    return unquote(text) or None


def _extract_username(handle: str | None) -> str | None:
    """Backward-compatible generic extractor for saved handles."""
    for platform in ("leetcode", "codeforces", "codechef"):
        username = normalize_platform_handle(platform, handle)
        if username:
            return username
    return None

# ── HTTP config ───────────────────────────────────────────────────────────────

_TIMEOUT = httpx.Timeout(15.0)
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "application/json, text/plain, */*",
}


# ── Return type ───────────────────────────────────────────────────────────────

def _empty_stats(platform: str, handle: str, error: str = "") -> Dict[str, Any]:
    return {
        "platform":     platform,
        "handle":       handle,
        "rating":       0,
        "max_rating":   0,
        "rank":         "",
        "easy_solved":  0,
        "medium_solved": 0,
        "hard_solved":  0,
        "total_solved": 0,
        "error":        error,
    }


# ── LeetCode fetcher ──────────────────────────────────────────────────────────

_LC_QUERY = """
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
    profile {
      ranking
    }
  }
  userContestRanking(username: $username) {
    rating
    globalRanking
    attendedContestsCount
  }
}
"""

async def fetch_leetcode(handle: str) -> Dict[str, Any]:
    handle = normalize_platform_handle("leetcode", handle)
    if not handle:
        return _empty_stats("leetcode", handle, "no handle provided")

    headers = {
        **_HEADERS,
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "Origin":  "https://leetcode.com",
    }
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT, headers=headers, follow_redirects=True
        ) as client:
            resp = await client.post(
                "https://leetcode.com/graphql",
                json={
                    "query":         _LC_QUERY,
                    "variables":     {"username": handle},
                    "operationName": "getUserProfile",
                },
            )
            try:
                data = resp.json()
            except JSONDecodeError:
                resp.raise_for_status()
                logger.error("[LC] %s returned non-JSON body: status=%d", handle, resp.status_code)
                return _empty_stats("leetcode", handle, "LeetCode returned an invalid response")

            graphql_errors = data.get("errors") if isinstance(data, dict) else None
            if graphql_errors:
                message = "; ".join(
                    str(error.get("message", "GraphQL error"))
                    for error in graphql_errors
                    if isinstance(error, dict)
                ) or "GraphQL error"
                logger.error("[LC] %s GraphQL error: %s", handle, message)
                return _empty_stats("leetcode", handle, f"LeetCode API error: {message}")

            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                raise

        if not isinstance(data, dict):
            return _empty_stats("leetcode", handle, "LeetCode returned a malformed response")

        response_data = data.get("data")
        if response_data is None:
            logger.error("[LC] %s response missing data: status=%d", handle, resp.status_code)
            return _empty_stats("leetcode", handle, "LeetCode returned no profile data")
        if not isinstance(response_data, dict):
            return _empty_stats("leetcode", handle, "LeetCode returned malformed profile data")

        user = response_data.get("matchedUser")
        if user is None:
            return _empty_stats("leetcode", handle, f"User '{handle}' not found on LeetCode")
        if not isinstance(user, dict):
            return _empty_stats("leetcode", handle, "LeetCode returned malformed user data")

        # Parse difficulty counts
        counts = {}
        ac_counts = (user.get("submitStatsGlobal") or {}).get("acSubmissionNum") or []
        if isinstance(ac_counts, list):
            for entry in ac_counts:
                if not isinstance(entry, dict):
                    continue
                difficulty = str(entry.get("difficulty", "")).lower()
                try:
                    counts[difficulty] = int(entry.get("count", 0) or 0)
                except (TypeError, ValueError):
                    counts[difficulty] = 0
        easy   = counts.get("easy",   0)
        medium = counts.get("medium", 0)
        hard   = counts.get("hard",   0)

        contest = response_data.get("userContestRanking") or {}
        rating  = int(contest.get("rating", 0) or 0)

        logger.info("[LC] %s → easy=%d med=%d hard=%d rating=%d", handle, easy, medium, hard, rating)
        return {
            "platform":      "leetcode",
            "handle":        handle,
            "rating":        rating,
            "max_rating":    rating,
            "rank":          str(contest.get("globalRanking") or (user.get("profile") or {}).get("ranking") or ""),
            "easy_solved":   easy,
            "medium_solved": medium,
            "hard_solved":   hard,
            "total_solved":  easy + medium + hard,
            "error":         None,
        }

    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        if code == 403:
            err = "LeetCode refused the request"
        elif code == 429:
            err = "LeetCode rate limited the request"
        elif code >= 500:
            err = "LeetCode is temporarily unavailable"
        else:
            err = f"LeetCode HTTP {code}"
        logger.error("[LC] %s → %s", handle, err)
        return _empty_stats("leetcode", handle, err)
    except httpx.TimeoutException:
        logger.error("[LC] %s → timeout", handle)
        return _empty_stats("leetcode", handle, "LeetCode request timed out")
    except httpx.ConnectError as exc:
        logger.error("[LC] %s → connection error: %s", handle, exc)
        return _empty_stats("leetcode", handle, "Unable to connect to LeetCode")
    except httpx.RequestError as exc:
        logger.error("[LC] %s → request error: %s", handle, exc)
        return _empty_stats("leetcode", handle, "Unable to fetch LeetCode profile")
    except Exception as exc:
        logger.error("[LC] %s → %s", handle, exc)
        return _empty_stats("leetcode", handle, "Unable to parse LeetCode profile")


# ── Codeforces fetcher ────────────────────────────────────────────────────────

async def fetch_codeforces(handle: str) -> Dict[str, Any]:
    if not handle:
        return _empty_stats("codeforces", handle, "no handle provided")

    url = f"https://codeforces.com/api/user.info?handles={handle}"
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "OK":
            comment = data.get("comment", "unknown error")
            return _empty_stats("codeforces", handle, comment)

        info       = data["result"][0]
        rating     = info.get("rating",    0) or 0
        max_rating = info.get("maxRating", 0) or 0
        rank       = info.get("rank",      "")

        # Approximate difficulty split from rating tier
        if rating >= 2400:
            easy, medium, hard = 0,   50, 450
        elif rating >= 1900:
            easy, medium, hard = 0,  150, 200
        elif rating >= 1600:
            easy, medium, hard = 50, 200,  50
        elif rating >= 1200:
            easy, medium, hard = 150, 100, 10
        else:
            easy, medium, hard = 100, 30,   0

        logger.info("[CF] %s → rating=%d max=%d", handle, rating, max_rating)
        return {
            "platform":      "codeforces",
            "handle":        handle,
            "rating":        rating,
            "max_rating":    max_rating,
            "rank":          rank,
            "easy_solved":   easy,
            "medium_solved": medium,
            "hard_solved":   hard,
            "total_solved":  easy + medium + hard,
            "error":         None,
        }

    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        err  = f"Handle '{handle}' not found" if code == 400 else f"HTTP {code}"
        logger.error("[CF] %s → %s", handle, err)
        return _empty_stats("codeforces", handle, err)
    except Exception as exc:
        logger.error("[CF] %s → %s", handle, exc)
        return _empty_stats("codeforces", handle, str(exc))


# ── CodeChef fetcher (bs4 scraper) ───────────────────────────────────────────

async def fetch_codechef(handle: str) -> Dict[str, Any]:
    """
    Scrape https://www.codechef.com/users/{handle}.

    Extracts
    --------
    - Star rating (text like "★★★★")
    - Current rating and max rating
    - Number of fully-solved problems
    """
    if not handle:
        return _empty_stats("codechef", handle, "no handle provided")

    url = f"https://www.codechef.com/users/{handle}"
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)

        if resp.status_code == 404:
            return _empty_stats("codechef", handle, f"Handle '{handle}' not found on CodeChef")
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # ── Stars ────────────────────────────────────────────────────────────
        stars = ""
        star_tag = soup.select_one(".rating")
        if star_tag:
            stars = star_tag.get_text(strip=True)

        # ── Current rating ────────────────────────────────────────────────────
        current_rating = 0
        rating_num_tag = soup.select_one(".rating-number")
        if rating_num_tag:
            raw = rating_num_tag.get_text(strip=True).replace(",", "")
            try:
                current_rating = int(raw)
            except ValueError:
                pass

        # ── Max rating ────────────────────────────────────────────────────────
        # Appears as: "Highest Rating <b>1985</b>"
        max_rating = current_rating
        highest_label = soup.find(string=re.compile(r"highest\s+rating", re.IGNORECASE))
        if highest_label:
            parent = highest_label.find_parent()
            b_tag  = parent.find("b") if parent else None
            if b_tag:
                try:
                    max_rating = int(b_tag.get_text(strip=True).replace(",", ""))
                except ValueError:
                    pass

        # Fallback: search the profile header section
        if max_rating == current_rating:
            header_section = soup.select_one(".rating-header")
            if header_section:
                all_ratings = re.findall(r"\b(\d{3,4})\b", header_section.get_text())
                if len(all_ratings) >= 2:
                    try:
                        max_rating = max(int(r) for r in all_ratings)
                    except ValueError:
                        pass

        # ── Fully solved count ────────────────────────────────────────────────
        total_solved = 0

        # Strategy 1: "Fully Solved (N)" heading
        fully_heading = soup.find(string=re.compile(r"Fully\s+Solved", re.IGNORECASE))
        if fully_heading:
            parent = fully_heading.find_parent()
            if parent:
                m = re.search(r"\((\d+)\)", parent.get_text())
                if m:
                    total_solved = int(m.group(1))

        # Strategy 2: count individual problem links under the solved section
        if total_solved == 0:
            solved_section = soup.select_one("section.rating-data-section.problems-solved")
            if solved_section:
                # each problem is a <a> tag in a <p>
                problem_links = solved_section.select("p a")
                total_solved = len(problem_links)

        # Strategy 3: scan page for "N problems" text
        if total_solved == 0:
            problems_text = soup.find(string=re.compile(r"(\d+)\s+problems?\s+solved", re.IGNORECASE))
            if problems_text:
                m = re.search(r"(\d+)", problems_text)
                if m:
                    total_solved = int(m.group(1))

        # Approximate difficulty split (CodeChef doesn't tag by difficulty)
        if total_solved > 0:
            easy   = int(total_solved * 0.55)
            medium = int(total_solved * 0.35)
            hard   = total_solved - easy - medium
        else:
            easy = medium = hard = 0

        logger.info(
            "[CC] %s → rating=%d max=%d stars=%r solved=%d",
            handle, current_rating, max_rating, stars, total_solved,
        )
        return {
            "platform":      "codechef",
            "handle":        handle,
            "rating":        current_rating,
            "max_rating":    max_rating,
            "rank":          stars,
            "easy_solved":   easy,
            "medium_solved": medium,
            "hard_solved":   hard,
            "total_solved":  total_solved,
            "error":         None,
        }

    except httpx.HTTPStatusError as exc:
        err = f"HTTP {exc.response.status_code}"
        logger.error("[CC] %s → %s", handle, err)
        return _empty_stats("codechef", handle, err)
    except Exception as exc:
        logger.error("[CC] %s → %s", handle, exc)
        return _empty_stats("codechef", handle, str(exc))


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def sync_all_profiles(
    email: str,
    db:    Session,
) -> Dict[str, Any]:
    """
    1. Read handles from CPProfile row for *email*.
    2. Run all three fetchers in parallel.
    3. Update CPProfile columns in PostgreSQL.
    4. Return a normalised dict for the API response.
    """
    cp: Optional[CPProfile] = (
        db.query(CPProfile).filter(CPProfile.user_email == email).first()
    )
    if cp is None:
        raise ValueError(f"No CP profile found for {email}")

    lc_handle = normalize_platform_handle("leetcode", cp.leetcode_handle)
    cf_handle = normalize_platform_handle("codeforces", cp.codeforces_handle)
    cc_handle = normalize_platform_handle("codechef", cp.codechef_handle)

    if not any([lc_handle, cf_handle, cc_handle]):
        raise ValueError("No platform handles saved. Add handles first.")

    logger.info(
        "[CP] Syncing for %s — lc=%r cf=%r cc=%r",
        email, lc_handle, cf_handle, cc_handle,
    )

    # Parallel fetch
    lc, cf, cc = await asyncio.gather(
        fetch_leetcode(lc_handle),
        fetch_codeforces(cf_handle),
        fetch_codechef(cc_handle),
    )

    # Persist into CPProfile
    now = datetime.now(timezone.utc)

    cp.lc_rating        = lc["rating"]
    cp.lc_easy_solved   = lc["easy_solved"]
    cp.lc_medium_solved = lc["medium_solved"]
    cp.lc_hard_solved   = lc["hard_solved"]
    cp.lc_rank          = lc["rank"]

    cp.cf_rating     = cf["rating"]
    cp.cf_max_rating = cf["max_rating"]
    cp.cf_rank       = cf["rank"]

    cp.cc_rating       = cc["rating"]
    cp.cc_max_rating   = cc["max_rating"]
    cp.cc_stars        = cc["rank"]
    cp.cc_total_solved = cc["total_solved"]

    cp.last_synced_at = now
    db.commit()
    db.refresh(cp)

    logger.info("[CP] Sync complete for %s", email)

    # Build response
    total_easy   = lc["easy_solved"]   + cf["easy_solved"]   + cc["easy_solved"]
    total_medium = lc["medium_solved"] + cf["medium_solved"] + cc["medium_solved"]
    total_hard   = lc["hard_solved"]   + cf["hard_solved"]   + cc["hard_solved"]

    return {
        "synced_at":  now.isoformat(),
        "leetcode":   lc,
        "codeforces": cf,
        "codechef":   cc,
        "totals": {
            "easy":   total_easy,
            "medium": total_medium,
            "hard":   total_hard,
            "total":  total_easy + total_medium + total_hard,
        },
    }
