"""
AlgoReviewer – FastAPI entry point.
Thin wrapper: CORS middleware + router registration.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router
from backend.api.cp_routes import router as cp_router
from backend.core.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(
    title="AlgoReviewer",
    description="Autonomous Algorithmic Code Reviewer powered by LangGraph + Groq",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(router,    prefix="/api/v1")              # existing review pipeline
app.include_router(cp_router, prefix="/api/v1")              # CP dashboard (new)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "AlgoReviewer"}
