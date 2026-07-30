"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  ChevronUp,
  RotateCcw,
  FileCode2,
  Sparkles,
} from "lucide-react";

import { Header } from "@/components/ui/Header";
import { StatusBar } from "@/components/ui/StatusBar";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { AgentFeed } from "@/components/feed/AgentFeed";
import { ResultsDrawer } from "@/components/results/ResultsDrawer";

import { streamReview } from "@/lib/api";
import { DEFAULT_CODE, DEFAULT_PROBLEM } from "@/lib/utils";
import type {
  PipelineStatus,
  TimelineEntry,
  ReviewResult,
  SSEStatusEvent,
} from "@/lib/types";

let _entryId = 0;
const nextId = () => String(++_entryId);

export default function HomePage() {
  // ── Editor state ────────────────────────────────────────────────────────────
  const [code,    setCode]    = useState(DEFAULT_CODE);
  const [problem, setProblem] = useState(DEFAULT_PROBLEM);

  // ── Pipeline state ──────────────────────────────────────────────────────────
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [statusLabel,    setStatusLabel]    = useState("Ready to review");
  const [timeline,       setTimeline]       = useState<TimelineEntry[]>([]);
  const [activeNode,     setActiveNode]     = useState<string | null>(null);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);
  const [result,         setResult]         = useState<ReviewResult | null>(null);
  const [drawerOpen,     setDrawerOpen]     = useState(false);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const [elapsed,    setElapsed]    = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  // ── Cancel ref ──────────────────────────────────────────────────────────────
  const cancelRef = useRef<(() => void) | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    cancelRef.current?.();
    stopTimer();
    setPipelineStatus("idle");
    setStatusLabel("Ready to review");
    setTimeline([]);
    setActiveNode(null);
    setErrorMsg(null);
    setResult(null);
    setDrawerOpen(false);
    setElapsed(0);
  }, [stopTimer]);

  const handleSubmit = useCallback(() => {
    if (pipelineStatus === "running") return;
    handleReset();

    setPipelineStatus("running");
    setStatusLabel("Initialising pipeline…");
    startTimer();

    const cancel = streamReview(
      { code, problem_description: problem },
      {
        onStatus: (event: SSEStatusEvent) => {
          setActiveNode(event.node);
          setStatusLabel(event.label);

          setTimeline((prev) => {
            // If this node already has an entry, update its meta; otherwise append
            const exists = prev.findIndex((e) => e.node === event.node);
            const entry: TimelineEntry = {
              id:        exists >= 0 ? prev[exists].id : nextId(),
              node:      event.node,
              label:     event.label,
              status:    event.status,
              timestamp: new Date(),
              meta:      event,
            };
            if (exists >= 0) {
              const updated = [...prev];
              updated[exists] = entry;
              return updated;
            }
            return [...prev, entry];
          });
        },

        onResult: (res: ReviewResult) => {
          setResult(res);
          setPipelineStatus("completed");
          setStatusLabel("Review complete");
          setActiveNode(null);
          stopTimer();
          // Auto-open drawer after short delay
          setTimeout(() => setDrawerOpen(true), 600);
        },

        onError: (err) => {
          setErrorMsg(err.message);
          setPipelineStatus("error");
          setStatusLabel("Pipeline error");
          setActiveNode(null);
          stopTimer();
        },

        onDone: () => {
          cancelRef.current = null;
        },
      }
    );

    cancelRef.current = cancel;
  }, [code, problem, pipelineStatus, handleReset, startTimer, stopTimer]);

  const handleCancel = useCallback(() => {
    cancelRef.current?.();
    stopTimer();
    setPipelineStatus("idle");
    setStatusLabel("Cancelled");
    setActiveNode(null);
  }, [stopTimer]);

  const isRunning = pipelineStatus === "running";

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 grid-bg">
      <Header />

      <main className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* ── LEFT PANEL: Code Input ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x:   0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full lg:w-[52%] flex flex-col border-r border-slate-800/60 overflow-y-auto"
        >
          {/* Section header */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800/60">
            <FileCode2 size={15} className="text-slate-500" />
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Code Editor
            </span>
          </div>

          <div className="flex-1 p-5 space-y-4">
            {/* Problem description */}
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">
                Problem Description
              </label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                disabled={isRunning}
                rows={3}
                placeholder="Describe the algorithmic problem…"
                className="w-full resize-none rounded-lg bg-slate-900 border border-slate-800
                           text-slate-200 font-mono text-xs p-3 placeholder-slate-600
                           focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20
                           disabled:opacity-50 transition-colors"
              />
            </div>

            {/* Monaco editor */}
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">
                Python Code
              </label>
              <CodeEditor
                value={code}
                onChange={setCode}
                readOnly={isRunning}
                height="380px"
              />
            </div>

            {/* CTA buttons */}
            <div className="flex items-center gap-3">
              {!isRunning ? (
                <motion.button
                  onClick={handleSubmit}
                  disabled={!code.trim()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.97 }}
                >
                  <Sparkles size={16} />
                  Run Agentic Review
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleCancel}
                  className="flex-1 flex items-center justify-center gap-2
                             font-mono text-sm px-6 py-3 rounded-lg
                             bg-red-500/10 border border-red-500/30 text-red-400
                             hover:bg-red-500/20 transition-colors"
                  whileTap={{ scale: 0.97 }}
                >
                  <Square size={14} />
                  Cancel
                </motion.button>
              )}

              <button
                onClick={handleReset}
                disabled={isRunning}
                title="Reset"
                className="p-3 rounded-lg border border-slate-700 text-slate-500
                           hover:border-slate-600 hover:text-slate-300 transition-colors
                           disabled:opacity-30"
              >
                <RotateCcw size={15} />
              </button>
            </div>

            {/* Status bar */}
            <StatusBar
              status={pipelineStatus}
              label={statusLabel}
              elapsed={elapsed}
            />
          </div>
        </motion.section>

        {/* ── RIGHT PANEL: Agent Feed ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x:  0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full lg:w-[48%] flex flex-col min-h-[400px] lg:min-h-0"
        >
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <Play size={13} className="text-slate-500" />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                Agent Pipeline Feed
              </span>
            </div>
            <AnimatePresence>
              {isRunning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-mono text-cyan-400">LIVE</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <AgentFeed
              entries={timeline}
              activeNode={activeNode}
              error={errorMsg}
            />
          </div>

          {/* View results CTA (once complete) */}
          <AnimatePresence>
            {pipelineStatus === "completed" && result && (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                exit={{    y: 60, opacity: 0 }}
                transition={{ type: "spring", damping: 22, stiffness: 250 }}
                className="border-t border-slate-800/60 p-4"
              >
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-full flex items-center justify-center gap-2
                             font-mono text-sm font-semibold py-3 px-6 rounded-xl
                             bg-gradient-to-r from-cyan-500/20 to-blue-600/20
                             border border-cyan-500/40 text-cyan-300
                             hover:border-cyan-400 hover:text-cyan-200
                             transition-all duration-200 group"
                >
                  <ChevronUp size={16} className="group-hover:-translate-y-0.5 transition-transform" />
                  View Full Results & Diff
                  <span className="badge badge-green ml-1">
                    {Math.round(result.pass_rate * 100)}% pass
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </main>

      {/* ── Slide-up Results Drawer ─────────────────────────────────────────── */}
      <ResultsDrawer
        result={result}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
