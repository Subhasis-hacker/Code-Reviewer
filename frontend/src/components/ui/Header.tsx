"use client";

import { motion } from "framer-motion";
import { Cpu, Zap } from "lucide-react";

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 backdrop-blur-sm bg-slate-950/80 sticky top-0 z-30"
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
          <Cpu size={18} className="text-cyan-400" />
          <motion.div
            className="absolute inset-0 rounded-xl border border-cyan-400/30"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div>
          <h1 className="font-mono font-bold text-base text-slate-100 leading-none">
            AlgoReviewer
          </h1>
          <p className="text-xs text-slate-500 font-mono leading-none mt-0.5">
            Autonomous Code Intelligence
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="hidden sm:flex items-center gap-2">
        <span className="badge badge-cyan">
          <Zap size={11} />
          LangGraph
        </span>
        <span className="badge badge-purple">Groq LLMs</span>
        <span className="badge badge-green">Docker Sandbox</span>
      </div>
    </motion.header>
  );
}
