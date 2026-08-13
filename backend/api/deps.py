"""
app/api/deps.py
===============
Reusable FastAPI dependencies for the custom JWT auth system.

get_current_user
    Extracts the Bearer token, decodes it, and returns the User ORM object.
    Raises 401 if the token is missing, expired, or the user no longer exists.
"""

from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.models import User
from backend.core.security import decode_access_token

logger  = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=True)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db:    Session                       = Depends(get_db),
) -> User:
    """
    Validate Bearer JWT and return the corresponding User row.

    Usage
    -----
    @router.get("/protected")
    def protected(current_user: User = Depends(get_current_user)):
        return {"email": current_user.email}
    """
    payload = decode_access_token(creds.credentials)   # raises 401 on bad token

    email: str | None = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing 'sub' claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        logger.warning("JWT sub %r references non-existent user", email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please register or log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user