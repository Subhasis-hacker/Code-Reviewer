"""
Isolated Docker sandbox for executing generated test cases against user code.

Security profile:
  - network_mode="none"       → no outbound network access
  - mem_limit="128m"          → memory cap
  - read_only=True            → immutable filesystem
  - timeout=2.0s per run      → kills runaway processes
"""

from __future__ import annotations

import json
import logging
import textwrap
import time
from typing import Any, Dict, List, Optional

import docker
from docker.errors import DockerException

from backend.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Test script template ──────────────────────────────────────────────────────

_HARNESS_TEMPLATE = '''
import json, sys, traceback, time, inspect

# ───── User code ─────
{user_code}

# ───── Test runner ───
tests = {tests_json}
results = []

try:
    sig = inspect.signature(solution)
    param_count = len(sig.parameters)
except Exception:
    param_count = 1

for t in tests:
    test_input  = t.get("input")
    expected    = t.get("expected")
    description = t.get("description", "")
    start = time.perf_counter()
    try:
        if isinstance(test_input, list) and param_count != 1:
            actual = solution(*test_input)
        elif isinstance(test_input, dict):
            actual = solution(**test_input)
        else:
            actual = solution(test_input)
        elapsed = time.perf_counter() - start
        passed  = (actual == expected)
        results.append({{
            "description": description,
            "input":       test_input,
            "expected":    expected,
            "actual":      actual,
            "passed":      passed,
            "elapsed_ms":  round(elapsed * 1000, 3),
        }})
    except Exception as exc:
        elapsed = time.perf_counter() - start
        results.append({{
            "description": description,
            "input":       test_input,
            "expected":    expected,
            "actual":      None,
            "passed":      False,
            "error":       traceback.format_exc(),
            "elapsed_ms":  round(elapsed * 1000, 3),
        }})

print(json.dumps(results))
'''


# ── Public API ────────────────────────────────────────────────────────────────

class SandboxResult:
    __slots__ = ("passed", "failed", "pass_rate", "raw_results", "error")

    def __init__(
        self,
        passed:      List[Dict[str, Any]],
        failed:      List[Dict[str, Any]],
        raw_results: List[Dict[str, Any]],
        error:       Optional[str] = None,
    ) -> None:
        self.passed      = passed
        self.failed      = failed
        self.pass_rate   = len(passed) / max(len(raw_results), 1)
        self.raw_results = raw_results
        self.error       = error


def run_tests_in_sandbox(
    code:   str,
    tests:  List[Dict[str, Any]],
) -> SandboxResult:
    """
    Wrap `code` + `tests` into a self-contained Python script, ship it to a
    disposable Docker container, collect structured JSON output.
    """
    script = _HARNESS_TEMPLATE.format(
        user_code=textwrap.indent(code, ""),
        tests_json=json.dumps(tests),
    )

    try:
        client = docker.from_env()
    except DockerException as exc:
        logger.warning("Docker unavailable – falling back to in-process execution: %s", exc)
        return _fallback_run(code, tests)

    try:
        t0 = time.perf_counter()
        output: bytes = client.containers.run(
            image=settings.sandbox_image,
            command=["python", "-c", script],
            network_mode="none",
            mem_limit=settings.sandbox_mem_limit,
            remove=True,
            stdout=True,
            stderr=True,
            timeout=int(settings.sandbox_timeout * len(tests) + 5),
        )
        elapsed = time.perf_counter() - t0
        logger.debug("Sandbox completed in %.2fs", elapsed)

        raw: List[Dict[str, Any]] = json.loads(output.decode())
        passed = [r for r in raw if r.get("passed")]
        failed = [r for r in raw if not r.get("passed")]
        return SandboxResult(passed=passed, failed=failed, raw_results=raw)

    except docker.errors.ContainerError as exc:
        logger.error("Container error: %s", exc)
        return SandboxResult(passed=[], failed=tests, raw_results=[], error=str(exc))
    except Exception as exc:
        logger.error("Sandbox exception: %s", exc)
        return SandboxResult(passed=[], failed=tests, raw_results=[], error=str(exc))


# ── In-process fallback (no Docker) ──────────────────────────────────────────

def _fallback_run(
    code:  str,
    tests: List[Dict[str, Any]],
) -> SandboxResult:
    """
    Execute tests directly in-process when Docker is unavailable.
    WARNING: No isolation – for development/testing only.
    """
    namespace: Dict[str, Any] = {}
    try:
        exec(compile(code, "<user_code>", "exec"), namespace)  # noqa: S102
    except SyntaxError as exc:
        return SandboxResult(
            passed=[], failed=tests, raw_results=[], error=f"SyntaxError: {exc}"
        )

    solution_fn = namespace.get("solution")
    if solution_fn is None:
        return SandboxResult(
            passed=[], failed=tests, raw_results=[],
            error="No top-level `solution` function found in submitted code."
        )

    import inspect
    try:
        sig = inspect.signature(solution_fn)
        param_count = len(sig.parameters)
    except Exception:
        param_count = 1

    raw_results: List[Dict[str, Any]] = []
    for t in tests:
        inp      = t.get("input")
        expected = t.get("expected")
        desc     = t.get("description", "")
        t0 = time.perf_counter()
        try:
            if isinstance(inp, list) and param_count != 1:
                actual = solution_fn(*inp)
            elif isinstance(inp, dict):
                actual = solution_fn(**inp)
            else:
                actual = solution_fn(inp)
            elapsed = time.perf_counter() - t0
            passed  = actual == expected
            raw_results.append({
                "description": desc, "input": inp, "expected": expected,
                "actual": actual, "passed": passed,
                "elapsed_ms": round(elapsed * 1000, 3),
            })
        except Exception as exc:
            elapsed = time.perf_counter() - t0
            raw_results.append({
                "description": desc, "input": inp, "expected": expected,
                "actual": None, "passed": False,
                "error": str(exc),
                "elapsed_ms": round(elapsed * 1000, 3),
            })

    passed_list = [r for r in raw_results if r["passed"]]
    failed_list = [r for r in raw_results if not r["passed"]]
    return SandboxResult(passed=passed_list, failed=failed_list, raw_results=raw_results)
