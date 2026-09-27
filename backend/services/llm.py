from __future__ import annotations

import logging
from functools import lru_cache

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

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
    )


def invoke_llm(model_name: str, messages: list) -> str:
    llm = get_llm(model_name)
    response = llm.invoke(messages)
    return response.content