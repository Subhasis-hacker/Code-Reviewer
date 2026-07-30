"""
Centralized Groq LLM factory with Tenacity exponential-backoff retry.

Every agent calls `get_llm(model_name)` – never instantiates ChatGroq directly.
The `groq_call_with_retry` decorator wraps the actual invoke so that
groq.RateLimitError triggers backoff without crashing the graph.
"""

from __future__ import annotations

import logging
from functools import lru_cache, wraps
from typing import Any, Callable

import groq as groq_sdk
from langchain_groq import ChatGroq
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from dotenv import load_dotenv
load_dotenv()
from backend.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# ── LLM factory (cached per model name) ──────────────────────────────────────
import os
@lru_cache(maxsize=8)
def get_llm(model_name: str) -> ChatGroq:
    """Return a cached ChatGroq instance for the given model."""
    return ChatGroq(
        api_key=os.getenv('GROQ_API_KEY'),
        model_name=model_name,
        max_tokens=settings.max_tokens,
        temperature=0.1,
    )


# ── Tenacity retry decorator ─────────────────────────────────────────────────

def with_groq_retry(func: Callable) -> Callable:
    """
    Decorator that wraps any coroutine/function with Tenacity retry logic
    targeting groq.RateLimitError with exponential back-off.

    Waits: 2s → 4s → 8s → 16s → 30s (capped) across 5 attempts.
    """
    @retry(
        retry=retry_if_exception_type(groq_sdk.RateLimitError),
        wait=wait_exponential(
            multiplier=1,
            min=settings.retry_wait_min,
            max=settings.retry_wait_max,
        ),
        stop=stop_after_attempt(settings.retry_max_attempts),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        return func(*args, **kwargs)

    return wrapper


def invoke_llm(model_name: str, messages: list) -> str:
    """
    Helper that retrieves the cached LLM, invokes it, and returns the
    string content.  Wrapped with Groq retry logic.
    """
    @with_groq_retry
    def _invoke() -> str:
        llm = get_llm(model_name)
        response = llm.invoke(messages)
        return response.content

    return _invoke()
