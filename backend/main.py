"""
AlgoReviewer – FastAPI entry point.
Thin wrapper: CORS middleware + router registration.

ADDITIVE CHANGES (v3):
  - Added auth_router    → /api/v1/auth/*    (register, login, me)
  - Added cp_sql_router  → /api/v1/cp2/*     (sync-handles, dashboard-stats)
  - calls Base.metadata.create_all() on startup to provision JWT-auth tables

The existing LangGraph agents, Docker sandbox, and SSE /api/v1/review route
are completely untouched.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Existing routers (DO NOT MODIFY) ─────────────────────────────────────────
from backend.api.routes    import router
from backend.api.cp_routes import router as cp_router

# ── New routers (additive) ────────────────────────────────────────────────────
from backend.api.auth_routes    import router as auth_router
from backend.api.cp_sql_routes  import router as cp_sql_router

from backend.core.config   import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger   = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(
    title="AlgoReviewer",
    description=(
        "Autonomous Algorithmic Code Reviewer powered by LangGraph + Groq. "
        "Includes CP Dashboard with custom JWT auth."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(router,         prefix="/api/v1")   # SSE review pipeline (unchanged)
app.include_router(cp_router,      prefix="/api/v1")   # Supabase-Auth CP routes (unchanged)
app.include_router(auth_router,    prefix="/api/v1")   # NEW: JWT register/login/me
app.include_router(cp_sql_router,  prefix="/api/v1")   # NEW: JWT-protected CP sync/stats


# ── Startup: create SQLAlchemy tables ─────────────────────────────────────────
@app.on_event("startup")
def _create_tables() -> None:
    """
    Provision JWT-auth tables (users, cp_profiles) on first run.
    Idempotent — safe to call on every startup.
    Only runs if SUPABASE_DATABASE_URL is configured.
    """
    if not settings.SUPABASE_URL:
        logger.warning(
            "SUPABASE_DATABASE_URL not set — skipping SQLAlchemy table creation."
        )
        return
    try:
        from backend.core.database import Base, engine
        import backend.core.models  # noqa: F401 – registers models with Base
        Base.metadata.create_all(bind=engine)
        logger.info("SQLAlchemy tables verified/created.")
    except Exception as exc:
        logger.error("Table creation failed (non-fatal): %s", exc)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "AlgoReviewer", "version": "2.0.0"}
