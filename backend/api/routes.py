"""
POST /api/v1/review – Server-Sent Events (SSE) endpoint

Streams LangGraph node progress events back to the frontend in real-time
using FastAPI's native StreamingResponse (no third-party SSE libs required).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.agents.graph import compiled_graph
from backend.core.state import ReviewState

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request schema ─────────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    code:                str = Field(..., min_length=10, description="Python source code to review")
    problem_description: str = Field(default="", description="Optional problem statement")


# ── SSE helpers ───────────────────────────────────────────────────────────────

def _sse_event(event_type: str, payload: dict) -> str:
    """
    Formats the payload into the strict SSE text specification.
    Must include newlines and double newlines at the end.
    """
    data_str = json.dumps(payload)
    return f"event: {event_type}\ndata: {data_str}\n\n"


_NODE_LABELS: dict[str, str] = {
    "ingestion":    "Ingesting & sanitising code…",
    "syntax_guard": "Syntax-checking with AST + Groq…",
    "profiler":     "Profiling Big-O complexity…",
    "edge_case":    "Generating 20+ edge-case tests…",
    "sandbox":      "Executing tests in Docker sandbox…",
    "refactorer":   "Refactoring with llama3-70B…",
}


async def _stream_graph(request: ReviewRequest) -> AsyncGenerator[str, None]:
    """
    Run the LangGraph pipeline in a thread pool and yield SSE text chunks.
    """
    initial_state: ReviewState = {
        "problem_description": request.problem_description,
        "original_code":       request.code,
        "current_code":        request.code,
        "retry_count":         0,
        "generated_tests":     [],
        "failed_tests":        [],
        "pass_rate":           0.0,
        "bottlenecks":         [],
        "time_complexity":     "",
        "space_complexity":    "",
        "status":              "starting",
        "error_message":       "",
    }

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    def run_graph() -> None:
        try:
            for step in compiled_graph.stream(initial_state, stream_mode="updates"):
                for node_name, node_state in step.items():
                    label   = _NODE_LABELS.get(node_name, node_name)
                    status  = node_state.get("status", "")
                    payload = {
                        "node":            node_name,
                        "label":           label,
                        "status":          status,
                        "retry_count":     node_state.get("retry_count", 0),
                        "time_complexity": node_state.get("time_complexity", ""),
                        "space_complexity":node_state.get("space_complexity", ""),
                        "bottlenecks":     node_state.get("bottlenecks", []),
                        "pass_rate":       node_state.get("pass_rate", 0.0),
                        "test_count":      len(node_state.get("generated_tests", [])),
                        "failed_count":    len(node_state.get("failed_tests", [])),
                    }

                    if status == "error":
                        loop.call_soon_threadsafe(
                            queue.put_nowait,
                            _sse_event("error", {"message": node_state.get("error_message", "Unknown error")}),
                        )
                        loop.call_soon_threadsafe(queue.put_nowait, None)
                        return

                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        _sse_event("status", payload),
                    )

            final = compiled_graph.invoke(initial_state)
            loop.call_soon_threadsafe(
                queue.put_nowait,
                _sse_event("result", {
                    "original_code":   final.get("original_code", ""),
                    "refactored_code": final.get("current_code", ""),
                    "time_complexity": final.get("time_complexity", ""),
                    "space_complexity":final.get("space_complexity", ""),
                    "bottlenecks":     final.get("bottlenecks", []),
                    "pass_rate":       final.get("pass_rate", 0.0),
                    "retry_count":     final.get("retry_count", 0),
                    "generated_tests": final.get("generated_tests", []),
                    "failed_tests":    final.get("failed_tests", []),
                    "status":          "completed",
                }),
            )
        except Exception as exc:
            logger.exception("Graph execution error")
            loop.call_soon_threadsafe(
                queue.put_nowait,
                _sse_event("error", {"message": str(exc)}),
            )
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    asyncio.get_event_loop().run_in_executor(None, run_graph)

    while True:
        event_str = await queue.get()
        if event_str is None:
            break
        yield event_str


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/review")
async def review_code(request: ReviewRequest):
    """
    Stream review pipeline progress natively using FastAPI StreamingResponse.
    """
    return StreamingResponse(
        _stream_graph(request),
        media_type="text/event-stream",
    )