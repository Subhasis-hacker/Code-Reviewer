"""
backend/services/llm.py

Centralized Groq LLM client and invocation helpers.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, Sequence

from langchain_core.messages import BaseMessage
from langchain_groq import ChatGroq

from backend.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_settings():
    """Load application settings once."""
    return get_settings()


@lru_cache(maxsize=8)
def get_llm(model_name: str) -> ChatGroq:
    """
    Return a cached Groq chat model for the specified model ID.
    """
    settings = _get_settings()

    if not settings.groq_api_key:
        raise ValueError(
            "GROQ_API_KEY is missing. Add it to your .env file."
        )

    return ChatGroq(
        model=model_name,
        api_key=settings.groq_api_key,
        max_tokens=settings.max_tokens,
        temperature=0,
    )


def invoke_llm(
    model_name: str,
    messages: Sequence[str | BaseMessage | dict[str, Any]],
) -> str:
    """
    Invoke a Groq model and return its text response.
    """
    try:
        llm = get_llm(model_name)
        response = llm.invoke(list(messages))
        content = response.content

        if isinstance(content, str):
            return content

        # Handle structured or multimodal response content safely.
        if isinstance(content, list):
            return "\n".join(
                str(block["text"])
                for block in content
                if isinstance(block, dict) and "text" in block
            )

        return str(content)

    except Exception:
        logger.exception(
            "Groq LLM invocation failed for model '%s'",
            model_name,
        )
        raise
