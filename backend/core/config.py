"""
Centralized configuration via Pydantic-Settings.
Reads from environment variables / .env file.
"""

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

    # ── Groq ──────────────────────────────────────────────────────────────────
    groq_api_key: str = Field(..., description="Groq Cloud API key (required)")

    # ── Model routing matrix ───────────────────────────────────────────────────
    model_syntax:    str = Field(default="llama3-8b-8192",       description="Node 1.5 – Syntax micro-fixer")
    model_profiler:  str = Field(default="llama3-8b-8192",       description="Node 2  – Big-O profiler")
    model_edge_case: str = Field(default="mixtral-8x7b-32768",   description="Node 4  – Edge-case generator")
    model_refactor:  str = Field(default="llama3-70b-8192",      description="Node 5  – Algorithmic refactorer")

    # ── Token caps ────────────────────────────────────────────────────────────
    max_tokens: int = Field(default=1024)

    # ── Retry / backoff ───────────────────────────────────────────────────────
    retry_max_attempts: int   = Field(default=5)
    retry_wait_min:     float = Field(default=2.0)
    retry_wait_max:     float = Field(default=30.0)

    # ── Sandbox ───────────────────────────────────────────────────────────────
    docker_host:      str   = Field(default="unix:///var/run/docker.sock")
    sandbox_image:    str   = Field(default="python:3.11-slim")
    sandbox_timeout:  float = Field(default=2.0)
    sandbox_mem_limit: str  = Field(default="128m")

    # ── Graph ─────────────────────────────────────────────────────────────────
    max_retry_count: int = Field(default=3, description="Max LangGraph refactor-loop iterations")

    # ── Supabase ──────────────────────────────────────────────────────────────
    supabase_url:         str = Field(default="", description="Supabase project URL")
    supabase_service_key: str = Field(default="", description="Supabase service-role key (server only)")
    supabase_jwt_secret:  str = Field(default="", description="Supabase JWT secret for token verification")

    # ── CP Sync ───────────────────────────────────────────────────────────────
    cp_sync_timeout:      float = Field(default=15.0, description="HTTPX timeout per CP platform fetch")

    # ── API ───────────────────────────────────────────────────────────────────
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    @field_validator("groq_api_key")
    @classmethod
    def validate_groq_key(cls, v: str) -> str:
        if not v or v.startswith("gsk_your"):
            raise ValueError(
                "GROQ_API_KEY is not set. "
                "Copy .env.example → .env and add your real key."
            )
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
