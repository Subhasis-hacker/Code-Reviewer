"""
Node 4 – Edge-Case Generator

Uses mixtral-8x7b-32768 (high creativity) to generate 20+ diverse test cases
covering: empty inputs, single elements, duplicates, negatives, large inputs,
sorted/reverse-sorted arrays, Unicode, None/null, max-int boundaries, etc.

Output: a JSON array of test dicts compatible with the sandbox harness.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage

from backend.core.config import get_settings
from backend.core.state import ReviewState
from backend.services.llm import invoke_llm

logger = logging.getLogger(__name__)
settings = get_settings()

_SYSTEM_PROMPT = """You are an adversarial test engineer specialising in Python algorithms.
Generate exactly 22 diverse test cases for the provided function named `solution`.
Each test case must cover a DIFFERENT edge-case category.

Respond with ONLY a JSON array (no markdown, no explanation):
[
  {
    "description": "<one-line description of what this tests>",
    "input": <Python-serialisable value – single value OR list of args>,
    "expected": <Python-serialisable expected return value>
  },
  ...
]

Categories to cover (at minimum):
  empty input, single element, two elements, already sorted, reverse sorted,
  all duplicates, negative numbers, mixed pos/neg, zero, large N (1000+),
  max integer, float values, None input (if applicable), nested structures,
  very long strings, unicode characters, boundary values, alternating pattern,
  prime/composite numbers, performance stress test."""


def _extract_json_array(text: str) -> List[Dict[str, Any]]:
    """Robust extraction of a JSON array from LLM response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Find the outermost [ ... ]
    start = text.find("[")
    end   = text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("No JSON array found in LLM response")
    return json.loads(text[start : end + 1])


def edge_case_node(state: ReviewState) -> ReviewState:
    """
    Node 4: Generate 20+ test cases using Mixtral.
    """
    code    = state.get("current_code", "")
    problem = state.get("problem_description", "")
    logger.info("[Node 4] Generating edge cases with Mixtral")

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Problem: {problem or 'General algorithmic function'}\n\n"
                f"Function to test:\n```python\n{code}\n```\n\n"
                "Return the JSON test array now."
            )
        ),
    ]

    try:
        raw   = invoke_llm(settings.model_edge_case, messages)
        tests = _extract_json_array(raw)
        logger.info("[Node 4] Generated %d test cases", len(tests))
    except Exception as exc:
        logger.error("[Node 4] Edge-case generation failed: %s", exc)
        # Provide a minimal fallback set so the pipeline doesn't stall
        tests = [
            {"description": "empty list",  "input": [],    "expected": None},
            {"description": "single item", "input": [1],   "expected": None},
            {"description": "two items",   "input": [1,2], "expected": None},
        ]

    return {
        **state,
        "generated_tests": tests,
        "status": "generating_tests",
    }
