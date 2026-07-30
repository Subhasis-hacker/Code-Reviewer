"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Code2,
  ShieldCheck,
  BarChart3,
  FlaskConical,
  Terminal,
  Wrench,
} from "lucide-react";
import type { TimelineEntry, SSEStatusEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const NODE_ICONS: Record<string, React.ReactNode> = {
  ingestion:    <Code2      size={16} />,
  syntax_guard: <ShieldCheck size={16} />,
  profiler:     <BarChart3  size={16} />,
  edge_case:    <FlaskConical size={16} />,
  sandbox:      <Terminal   size={16} />,
  refactorer:   <Wrench     size={16} />,
};

const NODE_COLORS: Record<string, string> = {
  ingestion:    "text-cyan-400   border-cyan-500/40   bg-cyan-500/10",
  syntax_guard: "text-purple-400 border-purple-500/40 bg-purple-500/10",
  profiler:     "text-amber-400  border-amber-500/40  bg-amber-500/10",
  edge_case:    "text-blue-400   border-blue-500/40   bg-blue-500/10",
  sandbox:      "text-green-400  border-green-500/40  bg-green-500/10",
  refactorer:   "text-pink-400   border-pink-500/40   bg-pink-500/10",
};

interface TimelineItemProps {
  entry: TimelineEntry;
  isLast: boolean;
  isActive: boolean;
}

function TimelineItem({ entry, isLast, isActive }: TimelineItemProps) {
  const colors = NODE_COLORS[entry.node] ?? "text-slate-400 border-slate-500/40 bg-slate-500/10";
  const icon   = NODE_ICONS[entry.node] ?? <Circle size={16} />;
  const meta   = entry.meta;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1,  x: 0   }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative flex gap-4"
    >
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-gradient-to-b from-slate-600 to-transparent" />
      )}

      {/* Icon badge */}
      <div className={cn(
        "relative z-10 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center mt-0.5",
        colors,
        isActive && "animate-glow"
      )}>
        {isActive ? (
          <Loader2 size={16} className="animate-spin" />
        ) : entry.status === "error" ? (
          <AlertCircle size={16} className="text-red-400" />
        ) : (
          icon
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-semibold text-slate-200">
            {entry.label}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {entry.timestamp.toLocaleTimeString()}
          </span>
          {isActive && (
            <span className="badge badge-cyan text-xs animate-pulse">LIVE</span>
          )}
        </div>

        {/* Meta info */}
        {meta && (
          <div className="space-y-1.5">
            {meta.time_complexity && (
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-amber">
                  ⏱ Time: {meta.time_complexity}
                </span>
                {meta.space_complexity && (
                  <span className="badge badge-purple">
                    💾 Space: {meta.space_complexity}
                  </span>
                )}
              </div>
            )}
            {meta.bottlenecks && meta.bottlenecks.length > 0 && (
              <div className="text-xs text-slate-400 font-mono pl-1">
                ⚠ {meta.bottlenecks.slice(0, 2).join(" · ")}
              </div>
            )}
            {typeof meta.test_count === "number" && meta.test_count > 0 && (
              <div className="flex gap-2">
                <span className="badge badge-green">
                  <CheckCircle2 size={11} />
                  {meta.test_count - (meta.failed_count ?? 0)} passed
                </span>
                {(meta.failed_count ?? 0) > 0 && (
                  <span className="badge badge-red">
                    <AlertCircle size={11} />
                    {meta.failed_count} failed
                  </span>
                )}
              </div>
            )}
            {typeof meta.pass_rate === "number" && meta.pass_rate > 0 && (
              <div className="text-xs font-mono text-green-400">
                ✓ Pass rate: {Math.round(meta.pass_rate * 100)}%
              </div>
            )}
            {(meta.retry_count ?? 0) > 0 && (
              <div className="text-xs font-mono text-amber-400">
                ↺ Refactor attempt #{meta.retry_count}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface AgentFeedProps {
  entries: TimelineEntry[];
  activeNode: string | null;
  error: string | null;
}

export function AgentFeed({ entries, activeNode, error }: AgentFeedProps) {
  if (entries.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl border border-slate-700 flex items-center justify-center mb-4 bg-slate-800/50">
          <Terminal size={28} className="text-slate-600" />
        </div>
        <p className="text-slate-500 font-mono text-sm mb-2">Agent feed empty</p>
        <p className="text-slate-600 text-xs max-w-48">
          Submit code and the autonomous pipeline will stream events here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-0 overflow-y-auto max-h-full">
      <AnimatePresence initial={false}>
        {entries.map((entry, i) => (
          <TimelineItem
            key={entry.id}
            entry={entry}
            isLast={i === entries.length - 1}
            isActive={activeNode === entry.node && i === entries.length - 1}
          />
        ))}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-lg border border-red-500/30 bg-red-500/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-red-400 font-mono text-sm font-semibold">Pipeline Error</span>
          </div>
          <p className="text-red-300/80 text-xs font-mono">{error}</p>
        </motion.div>
      )}
    </div>
  );
}
