"""
LangGraph ReviewState – the single source of truth that flows through every node.
"""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class ReviewState(TypedDict, total=False):
    # ── Input ─────────────────────────────────────────────────────────────────
    problem_description: str        # User-supplied problem statement
    original_code:       str        # Immutable snapshot of the submitted code
    current_code:        str        # Mutable – modified by refactorer on each loop

    # ── Complexity analysis ───────────────────────────────────────────────────
    time_complexity:  str           # e.g. "O(N²)"
    space_complexity: str           # e.g. "O(1)"
    bottlenecks:      List[str]     # Identified hot-spots

    # ── Test suite ────────────────────────────────────────────────────────────
    generated_tests: List[Dict[str, Any]]   # 20+ dicts: {input, expected, description}
    failed_tests:    List[Dict[str, Any]]   # Subset that failed during sandbox run
    pass_rate:       float                  # 0.0–1.0

    # ── Loop control ──────────────────────────────────────────────────────────
    retry_count: int    # Incremented each time we re-enter refactorer; capped at 3

    # ── Pipeline status (emitted as SSE events) ───────────────────────────────
    status: str         # One of: ingesting | syntax_checking | profiling |
                        #         generating_tests | executing_sandbox |
                        #         refactoring | completed | error

    # ── Error reporting ───────────────────────────────────────────────────────
    error_message: str
