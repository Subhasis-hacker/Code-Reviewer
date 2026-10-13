"""
app/core/models.py
==================
SQLAlchemy ORM table definitions.

Tables
------
  users           email PK, name, hashed_password
  cp_profiles     one CP profile per user, holds platform handles + cached stats

These are created via Base.metadata.create_all(bind=engine) in main.py startup.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Boolean,
    Integer,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.core.database import Base


# ── users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    email          = Column(String(255), primary_key=True, index=True)
    name           = Column(String(255), nullable=False)
    hashed_password = Column(Text, nullable=False)
    created_at     = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at     = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # One-to-one: each user has exactly one CP profile
    cp_profile = relationship(
        "CPProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User email={self.email!r}>"


# ── cp_profiles ───────────────────────────────────────────────────────────────

class CPProfile(Base):
    __tablename__ = "cp_profiles"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_email = Column(
        String(255),
        ForeignKey("users.email", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Platform handles ──────────────────────────────────────────────────────
    leetcode_handle   = Column(String(100), nullable=True)
    codeforces_handle = Column(String(100), nullable=True)
    codechef_handle   = Column(String(100), nullable=True)

    # ── Cached LeetCode stats ─────────────────────────────────────────────────
    lc_rating        = Column(Integer, default=0)
    lc_easy_solved   = Column(Integer, default=0)
    lc_medium_solved = Column(Integer, default=0)
    lc_hard_solved   = Column(Integer, default=0)
    lc_rank          = Column(String(100), nullable=True)

    # ── Cached Codeforces stats ───────────────────────────────────────────────
    cf_rating     = Column(Integer, default=0)
    cf_max_rating = Column(Integer, default=0)
    cf_rank       = Column(String(100), nullable=True)

    # ── Cached CodeChef stats ─────────────────────────────────────────────────
    cc_rating       = Column(Integer, default=0)
    cc_max_rating   = Column(Integer, default=0)
    cc_stars        = Column(String(20), nullable=True)   # e.g. "★★★★"
    cc_total_solved = Column(Integer, default=0)

    # ── Metadata ──────────────────────────────────────────────────────────────
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at     = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Relationship back to User ─────────────────────────────────────────────
    user = relationship("User", back_populates="cp_profile")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CPProfile user_email={self.user_email!r}>"


class CPSubmission(Base):
    __tablename__ = "cp_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email = Column(String(255), ForeignKey("users.email", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(32), nullable=False)
    handle = Column(String(100), nullable=False)
    submission_id = Column(String(160), nullable=False)
    problem_id = Column(String(260), nullable=False)
    problem_name = Column(String(500), nullable=True)
    verdict = Column(String(80), nullable=True)
    is_accepted = Column(Boolean, default=False, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    difficulty = Column(String(32), nullable=True)
    topics_csv = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_email", "platform", "submission_id", name="uq_cp_submission_user_platform_submission"),
        Index("ix_cp_submission_user_platform_problem", "user_email", "platform", "problem_id"),
    )


class CPProfileSnapshot(Base):
    __tablename__ = "cp_profile_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_email = Column(String(255), ForeignKey("users.email", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(32), nullable=False)
    snapshot_date = Column(DateTime(timezone=True), nullable=False, index=True)
    total_solved = Column(Integer, nullable=True)
    rating = Column(Integer, nullable=True)
    max_rating = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_email", "platform", "snapshot_date", name="uq_cp_snapshot_user_platform_date"),
    )
