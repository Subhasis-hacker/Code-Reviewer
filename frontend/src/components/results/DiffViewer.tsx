"use client";

import dynamic from "next/dynamic";
import { ArrowRight, TrendingDown } from "lucide-react";
import { complexityBadgeVariant, cn } from "@/lib/utils";
import type { ReviewResult } from "@/lib/types";
import { PassRateGauge } from "./PassRateGauge";

const MonacoDiff = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false, loading: () => <div className="h-80 bg-slate-900 animate-pulse rounded-lg" /> }
);

interface DiffViewerProps {
  result: ReviewResult;
}

export function DiffViewer({ result }: DiffViewerProps) {
  const improved =
    result.original_code.trim() !== result.refactored_code.trim();

  const origBadge = complexityBadgeVariant(result.time_complexity);

  return (
    <div className="space-y-6">
      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Pass rate gauge */}
        <div className="col-span-1 flex flex-col items-center gap-2 panel p-4">
          <PassRateGauge rate={result.pass_rate} size={100} />
          <span className="text-xs text-slate-500 font-mono">Test Pass Rate</span>
        </div>

        {/* Complexity */}
        <div className="col-span-1 sm:col-span-3 grid grid-rows-3 gap-3 panel p-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs font-mono w-20">Time O()</span>
            <span className={cn("badge", origBadge, "text-sm font-bold")}>
              {result.time_complexity || "?"}
            </span>
            {improved && (
              <>
                <ArrowRight size={14} className="text-slate-600" />
                <span className="badge badge-green text-sm font-bold flex items-center gap-1">
                  <TrendingDown size={13} />
                  Optimised
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs font-mono w-20">Space O()</span>
            <span className="badge badge-purple text-sm font-bold">
              {result.space_complexity || "?"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs font-mono w-20">Retries</span>
            <span className="badge badge-amber">{result.retry_count}</span>
            <span className="text-slate-500 text-xs font-mono">
              · {result.generated_tests.length} tests generated
              · {result.failed_tests.length} still failing
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottlenecks ───────────────────────────────────────────────────── */}
      {result.bottlenecks.length > 0 && (
        <div className="panel p-4">
          <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">
            Identified Bottlenecks
          </h4>
          <ul className="space-y-1.5">
            {result.bottlenecks.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-amber-400 mt-0.5">⚠</span>
                <span className="text-slate-300 font-mono text-xs">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Monaco Diff editor ────────────────────────────────────────────── */}
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-mono text-slate-400">Original</span>
          </div>
          <ArrowRight size={14} className="text-slate-600" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs font-mono text-slate-400">Refactored</span>
          </div>
        </div>
        <MonacoDiff
          height="400px"
          language="python"
          theme="vs-dark"
          original={result.original_code}
          modified={result.refactored_code}
          options={{
            readOnly: true,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderSideBySide: true,
            wordWrap: "on",
          }}
        />
      </div>

      {/* ── Failed tests table ───────────────────────────────────────────── */}
      {result.failed_tests.length > 0 && (
        <div className="panel p-4">
          <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">
            Remaining Failures ({result.failed_tests.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.failed_tests.map((t, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs font-mono"
              >
                <div className="text-red-400 font-semibold mb-1">{t.description}</div>
                <div className="text-slate-400">
                  input: <span className="text-slate-200">{JSON.stringify(t.input)}</span>
                </div>
                <div className="text-slate-400">
                  expected: <span className="text-green-400">{JSON.stringify(t.expected)}</span>
                  {" · "}
                  got: <span className="text-red-400">{JSON.stringify(t.actual)}</span>
                </div>
                {t.error && (
                  <div className="text-red-400/70 mt-1 truncate">{t.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
