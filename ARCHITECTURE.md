# AlgoReviewer — System Architecture

## Overview

AlgoReviewer is a stateful, event-driven AI system built around LangGraph's directed acyclic graph (DAG) primitives. The pipeline is deterministic in structure but adaptive in behaviour: it loops, retries, and self-corrects until test coverage reaches 100% or a configurable retry cap is hit.

---

## Component Breakdown

### 1. FastAPI Entry Point (`app/main.py`)

Thin ASGI server. Responsibilities:
- Mount CORS middleware (configurable origins via `settings.cors_origins`)
- Register API router at `/api/v1`
- Expose `/health` for orchestration probes

### 2. SSE Route (`app/api/routes.py`)

`POST /api/v1/review` accepts JSON `{code, problem_description}` and returns a streaming `text/event-stream` response.

Internally:
1. Initialises `ReviewState` TypedDict
2. Dispatches `compiled_graph.stream()` to a thread pool (non-blocking)
3. Enqueues SSE JSON payloads via `asyncio.Queue`
4. Yields events to the client as they arrive

### 3. LangGraph Graph (`app/agents/graph.py`)

```
ingestion → syntax_guard ──(error)──► END
                          │
                          ▼
                       profiler → edge_case → sandbox
                                                 │
                              ┌──────────────────┤
                              │  failed && retries < 3
                              ▼
                          refactorer → sandbox (loop)
                              │
                              │  all pass || retries == 3
                              ▼
                             END
```

**Conditional routing** (`should_refactor_or_end`):
- Reads `state["failed_tests"]` and `state["retry_count"]`
- Routes to `"refactorer"` if failures remain and budget allows
- Routes to `END` otherwise

### 4. ReviewState (`app/core/state.py`)

A `TypedDict` (not a Pydantic model) because LangGraph requires plain dict-compatible types for state merging. Fields are updated immutably — each node returns `{**state, ...overrides}`.

### 5. LLM Service (`app/services/llm.py`)

- `get_llm(model_name)`: `@lru_cache` — one `ChatGroq` instance per model name, alive for the process lifetime.
- `with_groq_retry`: Tenacity decorator. Catches `groq.RateLimitError` only (not other exceptions), waits `2^attempt` seconds, up to 5 attempts.
- `invoke_llm(model_name, messages)`: Convenience wrapper returning `response.content` string.

### 6. Docker Sandbox (`app/services/sandbox.py`)

Self-contained test harness:
1. Inlines user `code` + serialised `tests` into a Python script string
2. Passes the script as a `-c` argument to `python:3.11-slim` container
3. Captures stdout (JSON array of results) and stderr
4. Parses pass/fail per test case
5. Falls back to in-process execution if Docker daemon is unreachable (dev mode only)

Security constraints:
- `network_mode="none"` — no DNS, no HTTP
- `mem_limit="128m"` — prevents memory bombs
- `remove=True` — containers are destroyed after each run
- Script runs as default container user (non-root in slim images)

---

## Data Flow (Happy Path)

```
POST /api/v1/review
        │
        ▼
[ReviewState initialised]
        │
        ▼
Node 1 (ingestion)
  - Strip banned imports
  - Snapshot original_code
  - Set retry_count=0
        │
        ▼
Node 1.5 (syntax_guard)
  - ast.parse() → valid? skip LLM (0 API calls)
  - invalid?    → llama3-8b micro-fix → re-validate
        │
        ▼
Node 2 (profiler) [llama3-8b-8192]
  - JSON output: {time_complexity, space_complexity, bottlenecks}
        │
        ▼
Node 4 (edge_case) [mixtral-8x7b-32768]
  - JSON array of 22 test dicts
        │
        ▼
Node 3 (sandbox) [Docker]
  - Run all tests in isolated container
  - Update: failed_tests, pass_rate
        │
        ├── all pass ──► END → SSE "result" event
        │
        └── failures ──► Node 5 (refactorer) [llama3-70b-8192]
                              │
                              └── retry_count++ → Node 3 (loop)
```

---

## Rate-Limit Budget (Worst Case, 1 Review)

| Call | Model | Approx Tokens |
|------|-------|---------------|
| Syntax fix (only if broken) | llama3-8b | ~200 |
| Profiler | llama3-8b | ~400 |
| Edge-case gen | mixtral-8x7b | ~900 |
| Refactor ×3 (max) | llama3-70b | ~3×800 = 2400 |
| **Total (max)** | | **~3900 TPM** |

Well within Groq Free Tier limits (6K–30K TPM per model).

---

## Frontend Architecture

```
src/
├── app/
│   ├── layout.tsx     — Root HTML shell, dark mode class
│   ├── page.tsx       — Full split-pane page, SSE orchestration
│   └── globals.css    — Tailwind base + custom utilities
├── components/
│   ├── editor/
│   │   └── CodeEditor.tsx      — Monaco (dynamic import, SSR=false)
│   ├── feed/
│   │   └── AgentFeed.tsx       — Animated timeline of SSE events
│   ├── results/
│   │   ├── DiffViewer.tsx      — Monaco DiffEditor + stats
│   │   ├── PassRateGauge.tsx   — SVG ring gauge (Framer Motion)
│   │   └── ResultsDrawer.tsx   — Spring-animated bottom drawer
│   └── ui/
│       ├── Header.tsx           — Logo + tech badges
│       └── StatusBar.tsx        — Pipeline status pill
└── lib/
    ├── api.ts     — Fetch SSE client (ReadableStream parsing)
    ├── types.ts   — Shared TypeScript interfaces
    └── utils.ts   — cn(), complexity colouring, defaults
```

### SSE Client Design

The browser's native `EventSource` API only supports `GET` requests. Since we need to send a JSON body, `api.ts` uses `fetch()` with a `ReadableStream` reader instead, manually parsing the `data:` lines from the SSE wire format.

### State Management

No external state library. All pipeline state lives in `page.tsx` via `useState` / `useRef`. The `streamReview()` function returns a cancel handle that aborts the fetch on unmount or user cancellation.

---

## Security Considerations

1. **Input sanitisation**: Node 1 strips `os`, `sys`, `subprocess`, `socket` imports before code ever reaches the LLM or sandbox.
2. **Docker isolation**: Container has no network, no writable host mounts, and is destroyed after each run.
3. **Token cap**: `max_tokens=1024` on all LLM instances prevents unexpectedly large (and expensive) responses.
4. **No API key in frontend**: The Groq key lives only in the backend `.env` file and is never exposed to the client.
5. **CORS**: Configurable `CORS_ORIGINS` list — restrict to your frontend domain in production.
