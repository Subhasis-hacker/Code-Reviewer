"use client";

import { motion } from "framer-motion";
import { TrendingUp, Trophy, CheckCircle2, AlertCircle } from "lucide-react";
import type { PlatformStats } from "@/lib/cp_api";

// ── Platform branding ─────────────────────────────────────────────────────────

const PLATFORM_CONFIG = {
  leetcode: {
    name:       "LeetCode",
    accent:     "#ffa116",
    accentDim:  "#ffa11622",
    accentBorder:"#ffa11644",
    textClass:  "text-amber-400",
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#ffa116">
        <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.396c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.396a3.021 3.021 0 0 1-4.263.02L4.917 9.113a2.012 2.012 0 0 1-.074-2.828l3.854-4.127 3.497-3.746A1.374 1.374 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H19.7a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z"/>
      </svg>
    ),
  },
  codeforces: {
    name:       "Codeforces",
    accent:     "#1da1f2",
    accentDim:  "#1da1f222",
    accentBorder:"#1da1f244",
    textClass:  "text-sky-400",
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#1da1f2">
        <path d="M4.5 7.5C5.328 7.5 6 8.172 6 9v10.5c0 .828-.672 1.5-1.5 1.5h-3C.672 21 0 20.328 0 19.5V9c0-.828.672-1.5 1.5-1.5h3zm9.5-5C14.828 2.5 15.5 3.172 15.5 4v15.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V4c0-.828.672-1.5 1.5-1.5h3zm9.5 9c.828 0 1.5.672 1.5 1.5v6.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V13c0-.828.672-1.5 1.5-1.5h3z"/>
      </svg>
    ),
  },
  codechef: {
    name:       "CodeChef",
    accent:     "#5b4638",
    accentDim:  "#c07b4022",
    accentBorder:"#c07b4044",
    textClass:  "text-orange-400",
    logo: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#c07b40">
        <path d="M11.257.004C5.056.265-.178 5.624.007 11.997c.185 6.372 5.668 11.52 12.04 11.335 6.367-.185 11.516-5.668 11.332-12.04C23.193 5.12 17.784-.264 11.257.004zm-.815 4.706l.206 2.872-1.762 2.119-2.547-.588.494-2.825 3.61-1.578zm3.397 1.578 3.61 1.578.494 2.825-2.547.588-1.762-2.119.205-2.872zM5.544 12.23l2.069-1.269 2.259 2.715v2.528L7.41 17.29 5.544 12.23zm12.912 0L16.59 17.29l-2.463-1.085v-2.528l2.26-2.715 2.069 1.269zM10.96 15.66l1.04-.453 1.04.453.478 2.585-1.518 1.004-1.518-1.004.478-2.585z"/>
      </svg>
    ),
  },
} as const;

type Platform = keyof typeof PLATFORM_CONFIG;

interface PlatformCardProps {
  platform: Platform;
  stats:    PlatformStats | null;
  index:    number;
}

export function PlatformCard({ platform, stats, index }: PlatformCardProps) {
  const cfg = PLATFORM_CONFIG[platform];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y:  0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-4"
      style={{
        background:   `linear-gradient(135deg, ${cfg.accentDim}, rgba(15,22,41,0.95))`,
        borderColor:   cfg.accentBorder,
        boxShadow:    `0 0 24px ${cfg.accentDim}, 0 4px 32px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Glow orb */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ backgroundColor: cfg.accent }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: cfg.accentDim, border: `1px solid ${cfg.accentBorder}` }}
          >
            {cfg.logo}
          </div>
          <div>
            <div className="font-mono font-bold text-slate-100 text-sm">{cfg.name}</div>
            {stats?.handle ? (
              <div className="text-xs font-mono" style={{ color: cfg.accent }}>
                @{stats.handle}
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-600">not configured</div>
            )}
          </div>
        </div>
        {stats?.rank && (
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full border"
            style={{
              color:       cfg.accent,
              borderColor: cfg.accentBorder,
              background:  cfg.accentDim,
            }}
          >
            {stats.rank}
          </span>
        )}
      </div>

      {/* Error state */}
      {stats?.error && (
        <div className="flex items-center gap-2 text-xs text-red-400/80 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
          <AlertCircle size={13} />
          {stats.error}
        </div>
      )}

      {/* Rating row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">Rating</span>
          </div>
          <div className="font-mono font-bold text-xl" style={{ color: cfg.accent }}>
            {stats?.rating?.toLocaleString() ?? "—"}
          </div>
        </div>
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">Peak</span>
          </div>
          <div className="font-mono font-bold text-xl text-slate-200">
            {stats?.max_rating?.toLocaleString() ?? "—"}
          </div>
        </div>
      </div>

      {/* Difficulty mini-bars */}
      {stats && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
            <span className="flex items-center gap-1"><CheckCircle2 size={11} /> Total solved</span>
            <span className="font-bold text-slate-200">{stats.total_solved.toLocaleString()}</span>
          </div>

          {[
            { label: "Easy",   val: stats.easy_count,   color: "bg-emerald-500", total: stats.total_solved },
            { label: "Medium", val: stats.medium_count, color: "bg-amber-500",   total: stats.total_solved },
            { label: "Hard",   val: stats.hard_count,   color: "bg-red-500",     total: stats.total_solved },
          ].map(({ label, val, color, total: tot }) => {
            const pct = tot ? Math.round((val / tot) * 100) : 0;
            return (
              <div key={label} className="space-y-0.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-300">{val.toLocaleString()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 + 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!stats && (
        <div className="flex-1 flex items-center justify-center py-4">
          <p className="text-slate-600 text-xs font-mono text-center">
            Sync to load data
          </p>
        </div>
      )}
    </motion.div>
  );
}
