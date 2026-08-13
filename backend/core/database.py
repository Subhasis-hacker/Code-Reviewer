"""
app/core/database.py
====================
SQLAlchemy engine wired to SUPABASE_DATABASE_URL.

Usage in routes:
    from app.core.database import get_db
    from sqlalchemy.orm import Session

    @router.get("/...")
    def endpoint(db: Session = Depends(get_db)):
        ...

NOTE: This module is completely additive — it does NOT touch any agent,
sandbox, or SSE streaming code.
"""

from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.core.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()

# ── Engine ────────────────────────────────────────────────────────────────────
# pool_pre_ping keeps the Supabase Pooler connection alive across idle periods.
# connect_args are safe for both psycopg2 (direct) and the pooler URL.
engine = create_engine(
    settings.SUPABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=False,  # set True for SQL debug logging
)

# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ── Declarative base (shared by all models) ───────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── FastAPI dependency ─────────────────────────────────────────────────────────
def get_db():
    """
    Yield a SQLAlchemy Session and close it when the request finishes.
    Use as a FastAPI Depends() parameter.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()