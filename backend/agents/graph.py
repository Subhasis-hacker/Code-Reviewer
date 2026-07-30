"""
LangGraph workflow – AlgoReviewer pipeline

Graph topology:
  ingestion → syntax_guard → profiler → edge_case → sandbox
                                                         │
                   ┌──── (all pass OR max retries) ──── END
                   │
              refactorer ◄──── (tests failed) ──────────┘
                   │
                   └──► profiler (re-profile improved code)

Conditional routing:
  should_refactor_or_end()
    → "refactorer"  if failed tests exist AND retry_count < MAX_RETRY_COUNT
    → "end"         otherwise
"""

from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import END, StateGraph

from backend.agents.edge_case import edge_case_node
from backend.agents.ingestion import ingest_node
from backend.agents.profiler import profiler_node
from backend.agents.refactorer import refactorer_node
from backend.agents.syntax_guard import syntax_guard_node
from backend.core.config import get_settings
from backend.core.state import ReviewState
from backend.services.sandbox import run_tests_in_sandbox

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Sandbox wrapper node ──────────────────────────────────────────────────────

def sandbox_node(state: ReviewState) -> ReviewState:
    """Node 3: Execute generated tests inside an isolated Docker container."""
    code  = state.get("current_code", "")
    tests = state.get("generated_tests", [])
    logger.info("[Node 3] Sandbox: running %d tests", len(tests))

    result = run_tests_in_sandbox(code=code, tests=tests)

    return {
        **state,
        "failed_tests": result.failed,
        "pass_rate":    result.pass_rate,
        "status":       "executing_sandbox",
    }


# ── Conditional edge ──────────────────────────────────────────────────────────

def should_refactor_or_end(
    state: ReviewState,
) -> Literal["refactorer", "__end__"]:
    """
    Route to refactorer if tests are failing and we haven't hit max retries.
    Otherwise terminate the graph.
    """
    failed      = state.get("failed_tests", [])
    retry_count = state.get("retry_count", 0)

    if failed and retry_count < settings.max_retry_count:
        logger.info(
            "[Router] %d tests failing, retry %d/%d → refactoring",
            len(failed), retry_count, settings.max_retry_count,
        )
        return "refactorer"

    reason = "all tests pass" if not failed else f"max retries ({settings.max_retry_count}) reached"
    logger.info("[Router] %s → ending pipeline", reason)
    return END


# ── Error guard ───────────────────────────────────────────────────────────────

def error_guard(state: ReviewState) -> Literal["__end__", "profiler"]:
    """Short-circuit to END if an error occurred in the previous node."""
    if state.get("status") == "error":
        return END
    return "profiler"


# ── Graph builder ─────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(ReviewState)

    # Register nodes
    graph.add_node("ingestion",    ingest_node)
    graph.add_node("syntax_guard", syntax_guard_node)
    graph.add_node("profiler",     profiler_node)
    graph.add_node("edge_case",    edge_case_node)
    graph.add_node("sandbox",      sandbox_node)
    graph.add_node("refactorer",   refactorer_node)

    # Entry point
    graph.set_entry_point("ingestion")

    # Linear edges (pre-sandbox)
    graph.add_edge("ingestion",    "syntax_guard")

    # After syntax guard: abort on error, else profile
    graph.add_conditional_edges(
        "syntax_guard",
        lambda s: END if s.get("status") == "error" else "profiler",
        {"profiler": "profiler", END: END},
    )

    graph.add_edge("profiler",  "edge_case")
    graph.add_edge("edge_case", "sandbox")

    # After sandbox: refactor or finish
    graph.add_conditional_edges(
        "sandbox",
        should_refactor_or_end,
        {"refactorer": "refactorer", END: END},
    )

    # After refactoring: re-run profiler then edge_case then sandbox
    graph.add_edge("refactorer", "sandbox")

    return graph.compile()


# Singleton compiled graph
compiled_graph = build_graph()
