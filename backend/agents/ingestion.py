"""
Node 1 – Ingestion & Sanitizer

Responsibilities:
  - Strip unsafe constructs (imports of os/sys/subprocess/socket)
  - Normalise whitespace / tabs
  - Snapshot original_code so later nodes can diff against it
  - Set initial state fields
"""

from __future__ import annotations

import logging
import re

from backend.core.state import ReviewState

logger = logging.getLogger(__name__)

# Patterns that must not appear in sandboxed code
_BANNED_IMPORTS = re.compile(
    r"^\s*(?:import|from)\s+"
    r"(?:os|sys|subprocess|socket|shutil|pathlib|pty|signal|ctypes|cffi|_thread)",
    re.MULTILINE,
)

_BANNED_BUILTINS = re.compile(
    r"\b(?:__import__|eval|exec|compile|open|breakpoint)\s*\(",
)


def sanitize_code(code: str) -> tuple[str, list[str]]:
    """
    Remove or flag dangerous constructs.
    Returns (cleaned_code, list_of_warnings).
    """
    warnings: list[str] = []

    if _BANNED_IMPORTS.search(code):
        warnings.append("Removed banned system imports (os/sys/subprocess/socket).")
        code = _BANNED_IMPORTS.sub("# [REDACTED IMPORT]", code)

    if _BANNED_BUILTINS.search(code):
        warnings.append("Detected potentially dangerous builtin call.")

    # Normalise mixed tabs/spaces
    code = code.expandtabs(4)

    # Strip trailing whitespace per line
    code = "\n".join(line.rstrip() for line in code.splitlines())

    return code, warnings


# ── LangGraph node ────────────────────────────────────────────────────────────

def ingest_node(state: ReviewState) -> ReviewState:
    """
    Node 1: Sanitise the submitted code and initialise pipeline state.
    """
    logger.info("[Node 1] Ingesting code (%d chars)", len(state.get("original_code", "")))

    raw_code = state.get("original_code", "").strip()
    if not raw_code:
        return {
            **state,
            "status": "error",
            "error_message": "No code provided.",
        }

    cleaned, warnings = sanitize_code(raw_code)
    if warnings:
        logger.warning("[Node 1] Sanitiser warnings: %s", warnings)

    return {
        **state,
        "original_code":   raw_code,
        "current_code":    cleaned,
        "retry_count":     0,
        "generated_tests": [],
        "failed_tests":    [],
        "pass_rate":       0.0,
        "bottlenecks":     [],
        "time_complexity": "",
        "space_complexity": "",
        "status":          "ingesting",
    }
