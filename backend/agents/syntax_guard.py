"""
Node 1.5 – Syntax Guard

Strategy (zero-waste):
  1. Run Python's native ast.parse() FIRST (~1 ms, 0 API calls).
  2. If valid → skip LLM entirely, pass code downstream unchanged.
  3. If SyntaxError → call llama3-8b-8192 for a micro-fix attempt.
  4. Re-validate the fix; if still broken, surface an error state.
"""

from __future__ import annotations

import ast
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from backend.core.config import get_settings
from backend.core.state import ReviewState
from backend.services.llm import invoke_llm

logger = logging.getLogger(__name__)
settings = get_settings()

_SYSTEM_PROMPT = """You are a Python syntax correction assistant.
The user will send you Python code that failed ast.parse().
Return ONLY the corrected Python code with NO explanation, NO markdown fences.
Make the minimal change needed to fix the syntax error."""


def _ast_check(code: str) -> tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    try:
        ast.parse(code)
        return True, ""
    except SyntaxError as exc:
        return False, f"SyntaxError at line {exc.lineno}: {exc.msg}"


def syntax_guard_node(state: ReviewState) -> ReviewState:
    """
    Node 1.5: AST fast-path + optional Groq micro-fixer.
    """
    code = state.get("current_code", "")
    logger.info("[Node 1.5] Syntax-checking %d chars of code", len(code))

    is_valid, err_msg = _ast_check(code)

    # ── Fast-path: syntax OK → skip LLM ──────────────────────────────────────
    if is_valid:
        logger.info("[Node 1.5] AST valid – bypassing LLM (0 API calls)")
        return {**state, "status": "syntax_checking"}

    # ── Slow-path: ask Groq to fix the syntax ─────────────────────────────────
    logger.warning("[Node 1.5] %s – invoking micro-fixer LLM", err_msg)
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Fix the following Python code (syntax error: {err_msg}):\n\n"
                f"```python\n{code}\n```"
            )
        ),
    ]

    try:
        fixed_code = invoke_llm(settings.model_syntax, messages)
        # Strip any accidental markdown fences
        fixed_code = fixed_code.strip().removeprefix("```python").removeprefix("```").removesuffix("```").strip()
    except Exception as exc:
        logger.error("[Node 1.5] LLM call failed: %s", exc)
        return {
            **state,
            "status": "error",
            "error_message": f"Syntax fix failed: {err_msg}. LLM error: {exc}",
        }

    # Re-validate the fix
    still_valid, new_err = _ast_check(fixed_code)
    if not still_valid:
        return {
            **state,
            "status": "error",
            "error_message": f"Code has unfixable syntax errors: {new_err}",
        }

    logger.info("[Node 1.5] Syntax fixed by LLM")
    return {
        **state,
        "current_code": fixed_code,
        "status": "syntax_checking",
    }
