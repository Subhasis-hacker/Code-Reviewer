"use client";

import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { PipelineStatus } from "@/lib/types";

interface StatusBarProps {
  status: PipelineStatus;
  label: string;
  elapsed: number; // seconds
}

const STATUS_CONFIG = {
  idle:      { icon: Clock,         color: "text-slate-500", bg: "bg-slate-800/50",  label: "Ready" },
  running:   { icon: Loader2,       color: "text-cyan-400",  bg: "bg-cyan-500/10",   label: "Running" },
  completed: { icon: CheckCircle2,  color: "text-green-400", bg: "bg-green-500/10",  label: "Complete" },
  error:     { icon: AlertCircle,   color: "text-red-400",   bg: "bg-red-500/10",    label: "Error" },
};

export function StatusBar({ status, label, elapsed }: StatusBarProps) {
  const cfg  = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono ${cfg.bg}`}
    >
      <Icon
        size={13}
        className={`${cfg.color} ${status === "running" ? "animate-spin" : ""}`}
      />
      <span className={cfg.color}>{label || cfg.label}</span>
      {status === "running" && elapsed > 0 && (
        <span className="text-slate-600 ml-auto">{elapsed}s</span>
      )}
      {status === "completed" && (
        <span className="text-slate-600 ml-auto">in {elapsed}s</span>
      )}
    </motion.div>
  );
}
