"""
Node 5 – Algorithmic Refactorer

Uses Gemini to produce an optimized version of the code based on:

- Identified bottlenecks from the profiler
- Failed test cases from the sandbox
- Original problem description

Returns ONLY the refactored Python code.
"""

from __future__ import annotations

import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from backend.core.config import get_settings
from backend.core.state import ReviewState
from backend.services.llm import invoke_llm

logger = logging.getLogger(__name__)

settings = get_settings()


_SYSTEM_PROMPT = """You are a principal software engineer specialising in algorithmic optimisation.

You will receive:

1. The original problem description
2. The current Python code
3. Its identified Big-O complexity and bottlenecks
4. A list of failed test cases

Your task: return ONLY the refactored Python code.

Rules:

- Keep the function signature identical (name `solution`, same parameters)
- Fix ALL failing test cases
- Improve time/space complexity where possible
- No markdown fences
- No explanation
- No prose
- The code must be valid Python 3.11
"""


def _clean_code(raw: str) -> str:
    """Strip accidental markdown fencing from LLM output."""

    raw = raw.strip()

    # Remove opening ```python / ```
    raw = re.sub(
        r"^```(?:python)?\s*",
        "",
        raw,
        flags=re.IGNORECASE,
    )

    # Remove closing ```
    raw = re.sub(
        r"\s*```$",
        "",
        raw,
    )

    return raw.strip()


def refactorer_node(state: ReviewState) -> ReviewState:
    """
    Node 5: Produce an optimized version of current_code.
    """

    code = state.get("current_code", "")
    problem = state.get("problem_description", "")
    time_c = state.get("time_complexity", "O(?)")
    space_c = state.get("space_complexity", "O(?)")
    bottlenecks = state.get("bottlenecks", [])
    failed_tests = state.get("failed_tests", [])
    retry_count = state.get("retry_count", 0)

    logger.info(
        "[Node 5] Refactoring (retry %d/%d) – %d failing tests",
        retry_count + 1,
        settings.max_retry_count,
        len(failed_tests),
    )

    failed_summary = json.dumps(
        failed_tests[:10],
        indent=2,
    )

    messages = [
        SystemMessage(
            content=_SYSTEM_PROMPT
        ),
        HumanMessage(
            content=(
                f"Problem:\n{problem or 'Not provided'}\n\n"
                f"Current code:\n```python\n{code}\n```\n\n"
                f"Time complexity: {time_c}\n"
                f"Space complexity: {space_c}\n"
                f"Bottlenecks: "
                f"{', '.join(bottlenecks) or 'none identified'}\n\n"
                f"Failed tests (first 10):\n"
                f"{failed_summary}\n\n"
                "Return ONLY the refactored Python code."
            )
        ),
    ]

    # ---------------------------------------------------------
    # Call Gemini
    # ---------------------------------------------------------

    try:
        result = invoke_llm(
            settings.model_refactor,
            messages,
        )

        refactored_code = _clean_code(result)

        if not refactored_code:
            raise ValueError(
                "LLM returned empty refactored code"
            )

        logger.info(
            "[Node 5] Refactoring successful"
        )

        return {
            **state,
            "refactored_code": refactored_code,
            "llm_failed": False,
            "llm_error": "",
        }

    # ---------------------------------------------------------
    # Gemini/API failure
    # ---------------------------------------------------------

    except Exception as e:

        logger.error(
            "[Node 5] Refactorer LLM failed: %s",
            e,
        )

        return {
            **state,
            "refactored_code": code,
            "llm_failed": True,
            "llm_error": str(e),
        }