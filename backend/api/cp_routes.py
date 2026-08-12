"""
app/api/cp_routes.py
====================
Competitive Programming dashboard endpoints.

Endpoints
---------
  POST /api/v1/cp/sync
      Validates JWT Bearer token → pulls user profile → triggers parallel
      platform fetch → upserts DB → returns normalised JSON.

  GET  /api/v1/cp/dashboard
      Returns cached stats + 365-day heatmap from Supabase (no live fetch).

  PUT  /api/v1/cp/handles
      Save / update the user's platform handles in the profiles table.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
import os
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase import create_client, Client as SupabaseClient

from backend.core.config import get_settings
from backend.services.cp_sync import (
    CPSyncResult,
    fetch_dashboard_from_db,
    sync_all_platforms,
)

logger  = logging.getLogger(__name__)
router  = APIRouter(prefix="/cp", tags=["CP Dashboard"])
# settings = get_settings()
_bearer  = HTTPBearer(auto_error=True)
load_dotenv()

supabase_url=os.getenv("SUPABASE_URL")
supabase_service_key=os.getenv("")
# ── Supabase admin client (service-role key, server-side only) ────────────────

def _sb() -> SupabaseClient:
    if not supabase_url or not supabase_service_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured on this server.",
        )
    return create_client(supabase_url, supabase_service_key)


# ── JWT → user_id helper ──────────────────────────────────────────────────────

async def _get_user_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    Validate the Bearer token with Supabase and return the user's UUID.
    Raises 401 on any failure.
    """
    token = creds.credentials
    try:
        sb   = _sb()
        resp = sb.auth.get_user(token)
        user = resp.user
        if user is None:
            raise ValueError("null user")
        return str(user.id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )


# ── Request / response schemas ────────────────────────────────────────────────

class HandlesPayload(BaseModel):
    leetcode_handle:   Optional[str] = Field(default=None, max_length=50)
    codeforces_handle: Optional[str] = Field(default=None, max_length=50)
    codechef_handle:   Optional[str] = Field(default=None, max_length=50)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.put("/handles", summary="Save platform handles")
async def save_handles(
    payload: HandlesPayload,
    user_id: str = Depends(_get_user_id),
) -> Dict[str, Any]:
    """
    Store (or update) the user's CP platform usernames in the profiles table.
    """
    sb = _sb()
    update: Dict[str, Any] = {}
    if payload.leetcode_handle   is not None:
        update["leetcode_handle"]   = payload.leetcode_handle.strip() or None
    if payload.codeforces_handle is not None:
        update["codeforces_handle"] = payload.codeforces_handle.strip() or None
    if payload.codechef_handle   is not None:
        update["codechef_handle"]   = payload.codechef_handle.strip() or None

    if not update:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one handle to update.",
        )

    try:
        (
            sb.table("profiles")
            .update(update)
            .eq("id", user_id)
            .execute()
        )
    except Exception as exc:
        logger.error("DB update failed for user %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save handles.",
        )

    return {"ok": True, "updated": list(update.keys())}


@router.post("/sync", summary="Trigger CP platform sync")
async def sync_cp(
    user_id: str = Depends(_get_user_id),
) -> Dict[str, Any]:
    """
    1. Fetch the user's stored platform handles from the DB.
    2. Run parallel async fetchers (LeetCode, Codeforces, CodeChef).
    3. Upsert normalised data into Supabase.
    4. Return the full CPSyncResult as JSON.
    """
    sb = _sb()

    # Load handles from profiles table
    try:
        profile_resp = (
            sb.table("profiles")
            .select("leetcode_handle, codeforces_handle, codechef_handle")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile = profile_resp.data or {}
    except Exception as exc:
        logger.error("Profile fetch failed for user %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user profile.",
        )

    lc_handle = (profile.get("leetcode_handle")   or "").strip()
    cf_handle = (profile.get("codeforces_handle") or "").strip()
    cc_handle = (profile.get("codechef_handle")   or "").strip()

    if not any([lc_handle, cf_handle, cc_handle]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No CP handles saved. "
                "Use PUT /api/v1/cp/handles to add your usernames first."
            ),
        )

    try:
        result: CPSyncResult = await sync_all_platforms(
            user_id   = user_id,
            lc_handle = lc_handle,
            cf_handle = cf_handle,
            cc_handle = cc_handle,
        )
    except Exception as exc:
        logger.error("sync_all_platforms failed for user %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Platform sync error: {exc}",
        )

    return result.to_dict()


@router.get("/dashboard", summary="Fetch cached CP dashboard")
async def get_dashboard(
    user_id: str = Depends(_get_user_id),
) -> Dict[str, Any]:
    """
    Returns the user's cached stats and 365-day heatmap from Supabase.
    Does NOT trigger a live platform fetch — call /sync first.
    """
    try:
        data = fetch_dashboard_from_db(user_id)
    except Exception as exc:
        logger.error("Dashboard fetch failed for user %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load dashboard data.",
        )

    return data
