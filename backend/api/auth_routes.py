"""
app/api/auth_routes.py
======================
Custom JWT authentication endpoints.

  POST /api/v1/auth/register   – create account → return JWT
  POST /api/v1/auth/login      – validate credentials → return JWT
  GET  /api/v1/auth/me         – return current user info (protected)

These routes use SQLAlchemy + bcrypt + PyJWT.
They do NOT interact with Supabase Auth or the LangGraph pipeline.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.core.models import CPProfile, User
from backend.core.security import create_access_token, hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:    EmailStr
    name:     str     = Field(..., min_length=1, max_length=150)
    password: str     = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter.")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    email:        str
    name:         str


class UserResponse(BaseModel):
    email:      str
    name:       str
    created_at: str
    has_cp_profile: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account",
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Create a User row and an empty CPProfile, then return a signed JWT.
    Returns 409 if the email is already registered.
    """
    # Idempotency check
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already registered.",
        )

    # Persist user
    user = User(
        email           = payload.email,
        name            = payload.name.strip(),
        hashed_password = hash_password(payload.password),
    )
    db.add(user)
    db.flush()   # get PK without committing

    # Auto-create blank CP profile
    cp_profile = CPProfile(user_email=user.email)
    db.add(cp_profile)
    db.commit()
    db.refresh(user)

    logger.info("Registered new user: %s", user.email)

    token = create_access_token(subject=user.email)
    return TokenResponse(
        access_token=token,
        email=user.email,
        name=user.name,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in and receive a JWT",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Validate email + password and return a signed JWT.
    Returns 401 on bad credentials (deliberately no 'email not found' leak).
    """
    user = db.query(User).filter(User.email == payload.email).first()

    # Constant-time comparison regardless of whether email exists
    valid = (
        user is not None
        and verify_password(payload.password, user.hashed_password)
    )

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info("User logged in: %s", user.email)  # type: ignore[union-attr]
    token = create_access_token(subject=user.email)  # type: ignore[union-attr]
    return TokenResponse(
        access_token=token,
        email=user.email,  # type: ignore[union-attr]
        name=user.name,    # type: ignore[union-attr]
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user info",
)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the authenticated user's profile (no password)."""
    return UserResponse(
        email      = current_user.email,
        name       = current_user.name,
        created_at = current_user.created_at.isoformat(),
        has_cp_profile = current_user.cp_profile is not None,
    )