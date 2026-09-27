"""
Centralized Groq LLM factory with Tenacity exponential-backoff retry.

Every agent calls `get_llm(model_name)` – never instantiates ChatGroq directly.
The `groq_call_with_retry` decorator wraps the actual invoke so that
groq.RateLimitError triggers backoff without crashing the graph.
"""

"""
Centralized Gemini LLM factory.

Every agent calls get_llm(model_name).
No agent directly creates a Gemini model.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, Callable

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend.core.config import get_settings

load_dotenv()

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache(maxsize=8)
def get_llm(model_name: str) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.gemini_api_key,
        max_output_tokens=settings.max_tokens,
        temperature=0.1,
    )


def with_gemini_retry(func: Callable) -> Callable:
    @retry(
        retry=retry_if_exception_type(Exception),
        wait=wait_exponential(
            multiplier=1,
            min=settings.retry_wait_min,
            max=settings.retry_wait_max,
        ),
        stop=stop_after_attempt(settings.retry_max_attempts),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        return func(*args, **kwargs)

    return wrapper


def invoke_llm(model_name: str, messages: list) -> str:
    @with_gemini_retry
    def _invoke() -> str:
        llm = get_llm(model_name)
        response = llm.invoke(messages)
        return response.content

    return _invoke()