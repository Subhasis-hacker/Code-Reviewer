"""
Node 2 – Big-O Profiler

Uses llama3-8b-8192 (fast / low-token) to analyse time & space complexity
and identify algorithmic bottlenecks.

Output is enforced as structured JSON so we never need a second LLM call
to parse a verbose free-text response.
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

_SYSTEM_PROMPT = """You are an expert algorithm complexity analyst.
Analyse the submitted Python code and respond with ONLY a JSON object (no markdown, no preamble):
{
  "time_complexity": "<Big-O notation e.g. O(N^2)>",
  "space_complexity": "<Big-O notation e.g. O(N)>",
  "bottlenecks": ["<bottleneck 1>", "<bottleneck 2>", ...]
}
Be precise. Identify nested loops, redundant data structure operations, or suboptimal recursion."""


def _extract_json(text: str) -> dict:
    """Extract a JSON object from the LLM response, tolerating markdown fences."""
    text = text.strip()
    # Remove markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def profiler_node(state: ReviewState) -> ReviewState:
    """
    Node 2: Analyse Big-O complexity and surface bottlenecks.
    """
    code    = state.get("current_code", "")
    problem = state.get("problem_description", "")
    logger.info("[Node 2] Profiling complexity for %d chars", len(code))

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Problem statement: {problem or 'Not provided'}\n\n"
                f"Python code:\n```python\n{code}\n```"
            )
        ),
    ]

    try:
        raw = invoke_llm(settings.model_profiler, messages)
        data = _extract_json(raw)
    except json.JSONDecodeError:
        logger.warning("[Node 2] JSON parse failed – using defaults")
        data = {
            "time_complexity":  "O(?)",
            "space_complexity": "O(?)",
            "bottlenecks":      ["Could not parse profiler output"],
        }
    except Exception as exc:
        logger.error("[Node 2] Profiler LLM failed: %s", exc)
        return {
            **state,
            "status": "error",
            "error_message": f"Profiler failed: {exc}",
        }

    return {
        **state,
        "time_complexity":  data.get("time_complexity",  "O(?)"),
        "space_complexity": data.get("space_complexity", "O(?)"),
        "bottlenecks":      data.get("bottlenecks", []),
        "status":           "profiling",
    }
