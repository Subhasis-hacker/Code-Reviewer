import type {
  ReviewRequest,
  SSEStatusEvent,
  ReviewResult,
  SSEErrorEvent,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function streamReview(
  request: ReviewRequest,
  handlers: {
    onStatus: (event: SSEStatusEvent) => void;
    onResult: (result: ReviewResult) => void;
    onError:  (error: SSEErrorEvent) => void;
    onDone:   () => void;
  }
): () => void {
  // POST with body via fetch + ReadableStream (SSE over POST)
  let aborted = false;
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        handlers.onError({ message: `HTTP ${res.status}: ${text}` });
        handlers.onDone();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        handlers.onError({ message: "No response body" });
        handlers.onDone();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event:")) continue;
          if (!line.startsWith("data:")) continue;

          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const parsed = JSON.parse(raw);
            // Detect event type by shape
            if ("message" in parsed) {
              handlers.onError(parsed as SSEErrorEvent);
            } else if ("refactored_code" in parsed) {
              handlers.onResult(parsed as ReviewResult);
            } else {
              handlers.onStatus(parsed as SSEStatusEvent);
            }
          } catch {
            // Malformed SSE line – skip
          }
        }
      }
    } catch (err: unknown) {
      if (!aborted) {
        handlers.onError({
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      handlers.onDone();
    }
  })();

  return () => {
    aborted = true;
    controller.abort();
  };
}
