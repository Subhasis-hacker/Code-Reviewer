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

Submission Fetchers
-------------------
  fetch_leetcode_submissions(handle)    → GraphQL (recent AC submissions + topics)
  fetch_codeforces_submissions(handle)  → user.status API

Orchestrator
------------
  sync_all_profiles(email, db)
    → reads handles from CPProfile
    → runs all fetchers in parallel
    → updates CPProfile row in PostgreSQL
    → persists submissions + snapshots
    → returns normalised dict for the API response
"""

from __future__ import annotations
import asyncio
import logging
import re
from datetime import datetime, timezone
from json import JSONDecodeError
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlparse
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from backend.core.models import CPProfile, CPProfileSnapshot, CPSubmission

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
        "rating":       None,
        "max_rating":   None,
        "rank":         "",
        "stars":        "",
        "easy_solved":  None,
        "medium_solved": None,
        "hard_solved":  None,
        "total_solved": None,
        "error":        error,
    }


# ── Topic normalization ───────────────────────────────────────────────────────

# Map common topic tag variations to canonical names
_TOPIC_ALIASES = {
    "array": "Arrays",
    "arrays": "Arrays",
    "string": "Strings",
    "strings": "Strings",
    "dynamic programming": "Dynamic Programming",
    "dp": "Dynamic Programming",
    "graph": "Graphs",
    "graphs": "Graphs",
    "tree": "Trees",
    "trees": "Trees",
    "greedy": "Greedy",
    "binary search": "Binary Search",
    "binarysearch": "Binary Search",
    "backtracking": "Backtracking",
    "two pointers": "Two Pointers",
    "twopointers": "Two Pointers",
    "sliding window": "Sliding Window",
    "slidingwindow": "Sliding Window",
    "heap": "Heap / Priority Queue",
    "priority queue": "Heap / Priority Queue",
    "heap (priority queue)": "Heap / Priority Queue",
    "math": "Math",
    "number theory": "Math",
    "bit manipulation": "Bit Manipulation",
    "bitmasks": "Bit Manipulation",
    "bitmask": "Bit Manipulation",
    "linked list": "Linked List",
    "stack": "Stack / Queue",
    "queue": "Stack / Queue",
    "monotonic stack": "Stack / Queue",
    "hash table": "Hash Table",
    "hash map": "Hash Table",
    "hashing": "Hash Table",
    "sorting": "Sorting",
    "sort": "Sorting",
    "sortings": "Sorting",
    "depth-first search": "DFS / BFS",
    "dfs": "DFS / BFS",
    "breadth-first search": "DFS / BFS",
    "bfs": "DFS / BFS",
    "dfs and similar": "DFS / BFS",
    "union find": "Union Find",
    "disjoint set union": "Union Find",
    "dsu": "Union Find",
    "divide and conquer": "Divide and Conquer",
    "recursion": "Recursion",
    "simulation": "Simulation",
    "implementation": "Implementation",
    "brute force": "Brute Force",
    "constructive algorithms": "Constructive",
    "combinatorics": "Combinatorics",
    "geometry": "Geometry",
    "interactive": "Interactive",
    "prefix sum": "Prefix Sum",
    "matrix": "Matrix",
    "trie": "Trie",
    "segment tree": "Segment Tree",
    "binary indexed tree": "Binary Indexed Tree",
    "design": "Design",
    "database": "Database",
    "shortest paths": "Shortest Paths",
    "games": "Game Theory",
    "game theory": "Game Theory",
    "probabilities": "Probability",
    "flows": "Network Flow",
    "strings suffix structures": "String Algorithms",
    "string matching": "String Algorithms",
}


def normalize_topic(raw_tag: str) -> str:
    """Normalize a topic tag to a canonical display name."""
    clean = raw_tag.strip().lower()
    return _TOPIC_ALIASES.get(clean, raw_tag.strip().title())


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


# ── LeetCode submission/topic fetcher ─────────────────────────────────────────

_LC_SUBMISSIONS_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
  }
}
"""

_LC_PROBLEM_TAGS_QUERY = """
query problemTags($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    titleSlug
    difficulty
    topicTags {
      name
      slug
    }
  }
}
"""


async def fetch_leetcode_submissions(handle: str, limit: int = 200) -> List[Dict[str, Any]]:
    """Fetch recent accepted LeetCode submissions with topic tags.

    Uses the recentAcSubmissionList GraphQL query to get accepted submissions,
    then fetches topic tags for each unique problem via a batched approach.

    NOTE: LeetCode does not expose all-time submission history easily.
    This fetches only recent accepted submissions (up to `limit`).
    """
    handle = normalize_platform_handle("leetcode", handle)
    if not handle:
        return []

    headers = {
        **_HEADERS,
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "Origin": "https://leetcode.com",
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0), headers=headers, follow_redirects=True
        ) as client:
            # Step 1: Get recent accepted submissions
            resp = await client.post(
                "https://leetcode.com/graphql",
                json={
                    "query": _LC_SUBMISSIONS_QUERY,
                    "variables": {"username": handle, "limit": limit},
                },
            )
            try:
                data = resp.json()
            except JSONDecodeError:
                logger.warning("[LC-sub] %s: non-JSON response", handle)
                return []

            submissions_raw = (data.get("data") or {}).get("recentAcSubmissionList") or []
            if not isinstance(submissions_raw, list):
                return []

            # Deduplicate by titleSlug to get unique problems
            seen_slugs = {}
            for sub in submissions_raw:
                if not isinstance(sub, dict):
                    continue
                slug = sub.get("titleSlug")
                if not slug or slug in seen_slugs:
                    continue
                seen_slugs[slug] = sub

            # Step 2: Fetch topic tags for unique problems (batch with rate limit awareness)
            problem_tags = {}
            slugs_to_fetch = list(seen_slugs.keys())

            # Fetch in small batches to avoid rate limiting
            batch_size = 10
            for i in range(0, min(len(slugs_to_fetch), 100), batch_size):
                batch = slugs_to_fetch[i:i + batch_size]
                tasks = []
                for slug in batch:
                    tasks.append(
                        client.post(
                            "https://leetcode.com/graphql",
                            json={
                                "query": _LC_PROBLEM_TAGS_QUERY,
                                "variables": {"titleSlug": slug},
                            },
                        )
                    )
                try:
                    responses = await asyncio.gather(*tasks, return_exceptions=True)
                    for slug, tag_resp in zip(batch, responses):
                        if isinstance(tag_resp, Exception):
                            continue
                        try:
                            tag_data = tag_resp.json()
                        except (JSONDecodeError, Exception):
                            continue
                        question = (tag_data.get("data") or {}).get("question") or {}
                        tags = question.get("topicTags") or []
                        difficulty = question.get("difficulty")
                        problem_tags[slug] = {
                            "tags": [t.get("name", "") for t in tags if isinstance(t, dict) and t.get("name")],
                            "difficulty": difficulty,
                        }
                except Exception as exc:
                    logger.warning("[LC-sub] batch tag fetch failed: %s", exc)

                # Small delay between batches to respect rate limits
                if i + batch_size < len(slugs_to_fetch):
                    await asyncio.sleep(0.5)

        # Build submission rows
        rows = []
        for slug, sub in seen_slugs.items():
            submitted_at = None
            ts = sub.get("timestamp")
            if ts:
                try:
                    submitted_at = datetime.fromtimestamp(int(ts), tz=timezone.utc)
                except (ValueError, TypeError, OSError):
                    pass

            tags_info = problem_tags.get(slug, {})
            tags = tags_info.get("tags", [])
            difficulty = tags_info.get("difficulty")

            rows.append({
                "platform": "leetcode",
                "handle": handle,
                "submission_id": f"ac_{sub.get('id', slug)}",
                "problem_id": slug,
                "problem_name": sub.get("title"),
                "verdict": "Accepted",
                "is_accepted": True,
                "submitted_at": submitted_at,
                "difficulty": difficulty,
                "topics": tags,
            })

        logger.info("[LC-sub] %s → %d unique accepted problems fetched", handle, len(rows))
        return rows

    except Exception as exc:
        logger.warning("[LC-sub] submission fetch failed for %s: %s", handle, exc)
        return []


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

        logger.info("[CF] %s → rating=%d max=%d", handle, rating, max_rating)
        return {
            "platform":      "codeforces",
            "handle":        handle,
            "rating":        rating,
            "max_rating":    max_rating,
            "rank":          rank,
            "easy_solved":   None,
            "medium_solved": None,
            "hard_solved":   None,
            "total_solved":  None,
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

def _parse_first_int(text: str | None) -> Optional[int]:
    if not text:
        return None
    match = re.search(r"\b(\d{1,6})\b", text.replace(",", ""))
    return int(match.group(1)) if match else None


def _parse_codechef_solved_count(soup: BeautifulSoup) -> Optional[int]:
    solved_section = soup.select_one("section.rating-data-section.problems-solved")
    section_text = solved_section.get_text(" ", strip=True) if solved_section else ""

    match = re.search(r"Total\s+Problems\s+Solved\s*:?\s*(\d+)", section_text, re.IGNORECASE)
    if match:
        return int(match.group(1))

    fully_heading = soup.find(string=re.compile(r"Fully\s+Solved", re.IGNORECASE))
    if fully_heading:
        parent = fully_heading.find_parent()
        match = re.search(r"\((\d+)\)", parent.get_text(" ", strip=True) if parent else "")
        if match:
            return int(match.group(1))

    match = re.search(r"Total\s+Problems\s+Solved\s*:?\s*(\d+)", soup.get_text(" ", strip=True), re.IGNORECASE)
    if match:
        return int(match.group(1))

    if solved_section:
        problem_links = solved_section.select("p a")
        if problem_links:
            return len(problem_links)

    return None


async def fetch_codechef(handle: str) -> Dict[str, Any]:
    """
    Scrape https://www.codechef.com/users/{handle}.

    Extracts
    --------
    - Star rating (text like "★★★★")
    - Current rating and max rating
    - Number of fully-solved problems
    """
    handle = normalize_platform_handle("codechef", handle)
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

        final_path = httpx.URL(str(resp.url)).path.rstrip("/")
        if final_path != f"/users/{handle}":
            return _empty_stats("codechef", handle, f"Handle '{handle}' not found on CodeChef")

        soup = BeautifulSoup(resp.text, "lxml")
        if not soup.select_one(".widget-rating") and not soup.select_one(".problems-solved"):
            return _empty_stats("codechef", handle, "CodeChef profile data was not available")

        # ── Stars ────────────────────────────────────────────────────────────
        stars = ""
        star_tag = soup.select_one(".rating")
        if star_tag:
            stars = star_tag.get_text(strip=True)

        # ── Current rating ────────────────────────────────────────────────────
        current_rating: Optional[int] = None
        rating_num_tag = soup.select_one(".rating-number")
        if rating_num_tag:
            current_rating = _parse_first_int(rating_num_tag.get_text(" ", strip=True))
        if current_rating is None:
            rating_container = soup.select_one(".rating-container")
            current_rating = _parse_first_int(
                rating_container.get_text(" ", strip=True) if rating_container else None
            )
        if current_rating is None:
            logger.warning("[CC] %s → failed to parse current rating", handle)

        # ── Max rating ────────────────────────────────────────────────────────
        # Appears as: "Highest Rating <b>1985</b>"
        max_rating = current_rating or 0
        highest_label = soup.find(string=re.compile(r"highest\s+rating", re.IGNORECASE))
        if highest_label:
            parent = highest_label.find_parent()
            b_tag  = parent.find("b") if parent else None
            parsed_max = _parse_first_int(b_tag.get_text(" ", strip=True) if b_tag else None)
            if parsed_max is not None:
                max_rating = parsed_max

        # Fallback: search the profile header section
        if max_rating == (current_rating or 0):
            header_section = soup.select_one(".rating-header")
            if header_section:
                all_ratings = re.findall(r"\b(\d{3,4})\b", header_section.get_text())
                if len(all_ratings) >= 2:
                    try:
                        max_rating = max(int(r) for r in all_ratings)
                    except ValueError:
                        pass

        # ── Fully solved count ────────────────────────────────────────────────
        total_solved = _parse_codechef_solved_count(soup)
        solved_count_unavailable = total_solved is None
        if total_solved is None:
            logger.warning("[CC] %s → failed to parse solved count", handle)
            total_solved = 0

        errors = []
        if current_rating is None:
            errors.append("current rating unavailable")
            current_rating = 0
        page_text = soup.get_text(" ", strip=True)
        solved_zero_was_explicit = re.search(r"Total\s+Problems\s+Solved\s*:?\s*0\b", page_text, re.IGNORECASE)
        if solved_count_unavailable:
            errors.append("solved count unavailable")
        elif total_solved == 0 and not solved_zero_was_explicit:
            solved_section = soup.select_one("section.rating-data-section.problems-solved")
            if solved_section is None:
                errors.append("solved count unavailable")

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
            "stars":         stars,
            "easy_solved":   None,
            "medium_solved": None,
            "hard_solved":   None,
            "total_solved":  total_solved,
            "error":         "; ".join(errors) if errors else None,
        }

    except httpx.HTTPStatusError as exc:
        err = f"HTTP {exc.response.status_code}"
        logger.error("[CC] %s → %s", handle, err)
        return _empty_stats("codechef", handle, err)
    except Exception as exc:
        logger.error("[CC] %s → %s", handle, exc)
        return _empty_stats("codechef", handle, str(exc))


# ── Codeforces submissions fetcher ───────────────────────────────────────────

async def fetch_codeforces_submissions(handle: str, limit: int = 1000) -> List[Dict[str, Any]]:
    handle = normalize_platform_handle("codeforces", handle)
    if not handle:
        return []

    url = f"https://codeforces.com/api/user.status?handle={handle}&from=1&count={limit}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        if data.get("status") != "OK":
            logger.warning("[CF] submission history unavailable for %s: %s", handle, data.get("comment"))
            return []

        rows = []
        for item in data.get("result", []):
            problem = item.get("problem") or {}
            contest_id = problem.get("contestId")
            index = problem.get("index")
            if contest_id is None or index is None:
                problem_id = f"{problem.get('name') or 'unknown'}"
            else:
                problem_id = f"{contest_id}{index}"
            tags = problem.get("tags") if isinstance(problem.get("tags"), list) else []
            submitted_at = None
            if item.get("creationTimeSeconds"):
                submitted_at = datetime.fromtimestamp(int(item["creationTimeSeconds"]), tz=timezone.utc)
            rows.append({
                "platform": "codeforces",
                "handle": handle,
                "submission_id": str(item.get("id")),
                "problem_id": problem_id,
                "problem_name": problem.get("name"),
                "verdict": item.get("verdict"),
                "is_accepted": item.get("verdict") == "OK",
                "submitted_at": submitted_at,
                "difficulty": None,
                "topics": tags,
            })
        return rows
    except Exception as exc:
        logger.warning("[CF] submission history fetch failed for %s: %s", handle, exc)
        return []


# ── Persistence helpers ──────────────────────────────────────────────────────

def _persist_submissions(db: Session, email: str, submissions: List[Dict[str, Any]]) -> None:
    for row in submissions:
        if not row.get("submission_id") or not row.get("problem_id"):
            continue
        existing = (
            db.query(CPSubmission)
            .filter(
                CPSubmission.user_email == email,
                CPSubmission.platform == row["platform"],
                CPSubmission.submission_id == row["submission_id"],
            )
            .first()
        )
        topics_csv = ",".join(str(tag) for tag in row.get("topics", []) if tag)
        if existing:
            existing.verdict = row.get("verdict")
            existing.is_accepted = bool(row.get("is_accepted"))
            existing.topics_csv = topics_csv
            if row.get("difficulty"):
                existing.difficulty = row["difficulty"]
            continue
        db.add(CPSubmission(
            user_email=email,
            platform=row["platform"],
            handle=row["handle"],
            submission_id=row["submission_id"],
            problem_id=row["problem_id"],
            problem_name=row.get("problem_name"),
            verdict=row.get("verdict"),
            is_accepted=bool(row.get("is_accepted")),
            submitted_at=row.get("submitted_at"),
            difficulty=row.get("difficulty"),
            topics_csv=topics_csv,
        ))


def _snapshot(db: Session, email: str, platform: str, now: datetime, total: Optional[int], rating: Optional[int], max_rating: Optional[int]) -> None:
    snap = CPProfileSnapshot(
        user_email=email,
        platform=platform,
        snapshot_date=now,
        total_solved=total,
        rating=rating,
        max_rating=max_rating,
    )
    db.add(snap)


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def sync_all_profiles(
    email: str,
    db:    Session,
) -> Dict[str, Any]:
    """
    1. Read handles from CPProfile row for *email*.
    2. Run all fetchers in parallel (profile + submissions).
    3. Update CPProfile columns in PostgreSQL.
    4. Persist submissions and snapshots.
    5. Return a normalised dict for the API response.
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

    # Parallel fetch — fixed: properly destructure all 4 results
    lc, cf, cc, cf_submissions = await asyncio.gather(
        fetch_leetcode(lc_handle),
        fetch_codeforces(cf_handle),
        fetch_codechef(cc_handle),
        fetch_codeforces_submissions(cf_handle),
    )

    # Also fetch LeetCode submissions (not in original parallel to avoid LC rate limiting)
    lc_submissions = []
    if lc_handle and not lc.get("error"):
        try:
            lc_submissions = await fetch_leetcode_submissions(lc_handle)
        except Exception as exc:
            logger.warning("[CP] LeetCode submission fetch failed for %s: %s", lc_handle, exc)

    # Persist into CPProfile
    now = datetime.now(timezone.utc)

    if lc.get("error"):
        logger.warning("[CP] Skipping LeetCode stats persistence for %s: %s", lc_handle, lc["error"])
    else:
        cp.lc_rating        = lc["rating"] or 0
        cp.lc_easy_solved   = lc["easy_solved"] or 0
        cp.lc_medium_solved = lc["medium_solved"] or 0
        cp.lc_hard_solved   = lc["hard_solved"] or 0
        cp.lc_rank          = lc["rank"]

    if cf.get("error"):
        logger.warning("[CP] Skipping Codeforces stats persistence for %s: %s", cf_handle, cf["error"])
    else:
        cp.cf_rating     = cf["rating"] or 0
        cp.cf_max_rating = cf["max_rating"] or 0
        cp.cf_rank       = cf["rank"]

    if cc.get("error"):
        logger.warning("[CP] Skipping CodeChef stats persistence for %s: %s", cc_handle, cc["error"])
    else:
        cp.cc_rating       = cc["rating"]
        cp.cc_max_rating   = cc["max_rating"]
        cp.cc_stars        = cc.get("stars") or cc["rank"]
        cp.cc_total_solved = cc["total_solved"]

    cp.last_synced_at = now

    # Persist submissions
    _persist_submissions(db, email, cf_submissions)
    _persist_submissions(db, email, lc_submissions)

    # Create snapshots
    if not lc.get("error"):
        _snapshot(db, email, "leetcode", now, lc.get("total_solved"), lc.get("rating"), lc.get("max_rating"))
    if not cf.get("error"):
        accepted_cf = len({row["problem_id"] for row in cf_submissions if row.get("is_accepted")})
        cf["total_solved"] = accepted_cf
        _snapshot(db, email, "codeforces", now, accepted_cf, cf.get("rating"), cf.get("max_rating"))
    if not cc.get("error"):
        _snapshot(db, email, "codechef", now, cc.get("total_solved"), cc.get("rating"), cc.get("max_rating"))

    db.commit()
    db.refresh(cp)

    logger.info("[CP] Sync complete for %s", email)

    # Build response — only include real, verified difficulty data
    total_easy = lc.get("easy_solved") or 0
    total_medium = lc.get("medium_solved") or 0
    total_hard = lc.get("hard_solved") or 0

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
