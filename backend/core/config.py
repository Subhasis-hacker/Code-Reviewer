from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Gemini ───────────────────────────────────────────────────────────────
    gemini_api_key: str = Field(
        ...,
        description="Google Gemini API key"
    )

    # ─── Model routing matrix ────────────────────────────────────────────────
    model_syntax: str = Field(
        default="gemini-3.8-flash",
        description="Node 1.5 – Syntax micro-fixer"
    )

    model_profiler: str = Field(
        default="gemini-3.8-flash",
        description="Node 2 – Big-O profiler"
    )

    model_edge_case: str = Field(
        default="gemini-3.8-flash",
        description="Node 4 – Edge-case generator"
    )

    model_refactor: str = Field(
        default="gemini-3.8-flash",
        description="Node 5 – Algorithmic refactorer"
    )

    # ─── Token caps ─────────────────────────────────────────────────────────
    max_tokens: int = Field(default=1024)

    # ─── Retry / backoff ────────────────────────────────────────────────────
    retry_max_attempts: int = Field(default=5)
    retry_wait_min: float = Field(default=2.0)
    retry_wait_max: float = Field(default=30.0)

    # ─── Sandbox ─────────────────────────────────────────────────────────────
    docker_host: str = Field(
        default="unix:///var/run/docker.sock"
    )

    sandbox_image: str = Field(
        default="python:3.11-slim"
    )

    sandbox_timeout: float = Field(default=2.0)

    sandbox_mem_limit: str = Field(default="128m")

    # ─── Graph ───────────────────────────────────────────────────────────────
    max_retry_count: int = Field(
        default=3,
        description="Max LangGraph refactor-loop iterations"
    )

    # ─── Supabase ────────────────────────────────────────────────────────────
    SUPABASE_URL: str = Field(
        default="",
        description="Supabase project URL"
    )

    supabase_service_key: str = Field(
        default="",
        description="Supabase service-role key (server only)"
    )

    supabase_jwt_secret: str = Field(
        default="",
        description="Supabase JWT secret for token verification"
    )

    # ─── Custom JWT Auth ─────────────────────────────────────────────────────
    jwt_secret_key: str = Field(
        default="your-super-secret-key-change-in-production",
        description="Secret key used for signing JWTs"
    )

    jwt_algorithm: str = Field(default="HS256")

    jwt_expire_minutes: int = Field(
        default=1440,
        description="Token expiration duration in minutes"
    )

    # ─── CP Sync ─────────────────────────────────────────────────────────────
    cp_sync_timeout: float = Field(
        default=15.0,
        description="HTTPX timeout per CP platform fetch"
    )

    # ─── API & CORS ──────────────────────────────────────────────────────────
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://code-reviewer-beige.vercel.app",
        ],
        description="Allowed frontend origin URLs for CORS",
    )

    @field_validator("gemini_api_key")
    @classmethod
    def validate_gemini_key(cls, v: str) -> str:
        if not v:
            raise ValueError(
                "GEMINI_API_KEY is not set. "
                "Add your real Gemini API key."
            )
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()