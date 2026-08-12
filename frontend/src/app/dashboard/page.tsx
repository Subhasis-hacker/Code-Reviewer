"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Settings,
  LogOut,
  Cpu,
  Zap,
  TrendingUp,
  Code2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Activity,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { fetchDashboard, triggerSync } from "@/lib/cp_api";
import type { DashboardData, PlatformStats, SyncResult } from "@/lib/cp_api";
import { PlatformCard } from "@/components/dashboard/PlatformCard";
import { Heatmap }       from "@/components/dashboard/Heatmap";
import { DonutChart }    from "@/components/dashboard/DonutChart";
import { HandlesModal }  from "@/components/dashboard/HandlesModal";

type SyncState = "idle" | "syncing" | "success" | "error";

// ── Tiny stat chip ────────────────────────────────────────────────────────────
function StatChip({
  icon: Icon,
  label,
  value,
  color = "text-cyan-400",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3">
      <Icon size={16} className={color} />
      <div>
        <div className={`font-mono font-bold text-lg leading-none ${color}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-xs text-slate-500 font-mono mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── Main dashboard page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [userId,   setUserId]   = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Sync ──────────────────────────────────────────────────────────────────
  const [syncState,  setSyncState]  = useState<SyncState>("idle");
  const [syncError,  setSyncError]  = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);

  // ── Check auth ────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth");
        return;
      }
      setUserId(user.id);
      setAuthReady(true);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/auth");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // ── Load dashboard data ───────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchDashboard();
      setDashboard(data);
      // Surface last sync time from any platform
      const stats = Object.values(data.platform_stats);
      if (stats.length > 0 && (stats[0] as { last_synced_at?: string }).last_synced_at) {
        setLastSynced((stats[0] as { last_synced_at?: string }).last_synced_at ?? null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard";
      // First-time user with no data yet — that's OK
      if (!msg.includes("Failed to fetch") && !msg.includes("404")) {
        setLoadError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [authReady]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  // ── Sync profiles ─────────────────────────────────────────────────────────
  const handleSync = async () => {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    setSyncError(null);
    try {
      const result = await triggerSync();
      setSyncResult(result);
      setSyncState("success");
      setLastSynced(result.synced_at);
      // Refresh dashboard from DB after sync
      await loadDashboard();
      setTimeout(() => setSyncState("idle"), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setSyncError(msg);
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 5000);
    }
  };

  // ── Computed values ───────────────────────────────────────────────────────
  const profile = dashboard?.profile;
  const handles = {
    leetcode:   profile?.leetcode_handle   ?? "",
    codeforces: profile?.codeforces_handle ?? "",
    codechef:   profile?.codechef_handle   ?? "",
  };

  const lcStats = (dashboard?.platform_stats?.["leetcode"]   ?? null) as (PlatformStats & { total_solved: number }) | null;
  const cfStats = (dashboard?.platform_stats?.["codeforces"] ?? null) as (PlatformStats & { total_solved: number }) | null;
  const ccStats = (dashboard?.platform_stats?.["codechef"]   ?? null) as (PlatformStats & { total_solved: number }) | null;

  // Use live sync result if available, else cached DB data
  const activeLc  = syncResult?.leetcode   ?? lcStats;
  const activeCf  = syncResult?.codeforces ?? cfStats;
  const activeCc  = syncResult?.codechef   ?? ccStats;

  const totalEasy   = (activeLc?.easy_count   ?? 0) + (activeCf?.easy_count   ?? 0) + (activeCc?.easy_count   ?? 0);
  const totalMedium = (activeLc?.medium_count ?? 0) + (activeCf?.medium_count ?? 0) + (activeCc?.medium_count ?? 0);
  const totalHard   = (activeLc?.hard_count   ?? 0) + (activeCf?.hard_count   ?? 0) + (activeCc?.hard_count   ?? 0);
  const totalSolved = totalEasy + totalMedium + totalHard;

  const maxRating = Math.max(
    activeLc?.rating ?? 0,
    activeCf?.rating ?? 0,
    activeCc?.rating ?? 0,
  );

  const heatmapData = dashboard?.heatmap ?? [];

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 grid-bg flex flex-col">

      {/* ── Top Navigation Bar ────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y:   0 }}
        className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Cpu size={18} className="text-cyan-400" />
            </div>
            <div>
              <div className="font-mono font-bold text-sm text-slate-100 leading-none">
                AlgoReviewer
              </div>
              <div className="text-xs text-slate-500 font-mono leading-none mt-0.5">
                CP Dashboard
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            <a
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
                         text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Code2 size={13} />
              Code Review
            </a>
            <span className="w-px h-4 bg-slate-800" />
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
                             text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
              <Activity size={13} />
              Dashboard
            </span>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Last synced */}
            {lastSynced && (
              <span className="hidden md:block text-xs text-slate-600 font-mono">
                Synced {new Date(lastSynced).toLocaleTimeString()}
              </span>
            )}

            {/* Settings */}
            <button
              onClick={() => setModalOpen(true)}
              className="p-2 rounded-lg border border-slate-700 text-slate-500
                         hover:border-slate-600 hover:text-slate-200 transition-colors"
              title="Platform handles"
            >
              <Settings size={15} />
            </button>

            {/* Sync button */}
            <motion.button
              onClick={handleSync}
              disabled={syncState === "syncing"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold
                         transition-all duration-200 disabled:opacity-50
                         bg-gradient-to-r from-cyan-500/20 to-blue-600/20
                         border border-cyan-500/40 text-cyan-300
                         hover:border-cyan-400 hover:text-cyan-100"
              whileTap={{ scale: 0.96 }}
            >
              <RefreshCw
                size={13}
                className={syncState === "syncing" ? "animate-spin" : ""}
              />
              {syncState === "syncing" ? "Syncing…"  :
               syncState === "success" ? "Synced ✓"  :
               syncState === "error"   ? "Retry"     :
               "Sync Profiles"}
            </motion.button>

            {/* Avatar + sign-out */}
            <div className="relative group">
              <button className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-bold text-xs text-white">
                {profile?.username?.[0]?.toUpperCase() ?? "U"}
              </button>
              <div className="absolute right-0 top-10 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-150 z-50">
                <div className="panel p-1 min-w-[140px]">
                  <div className="px-3 py-2 text-xs font-mono text-slate-400 border-b border-slate-800">
                    {profile?.username ?? "User"}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono
                               text-red-400 hover:bg-red-500/10 transition-colors mt-0.5"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">

        {/* Sync error banner */}
        <AnimatePresence>
          {syncError && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y:   0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30
                         bg-amber-500/10 text-amber-300 text-sm font-mono"
            >
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{syncError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load error */}
        {loadError && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm font-mono">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        )}

        {/* ── Welcome / onboarding state ─────────────────────────────────── */}
        {!loading && !dashboard && !loadError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            className="panel p-10 flex flex-col items-center text-center gap-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Zap size={28} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-xl text-slate-100 mb-2">
                Welcome to your CP Dashboard!
              </h2>
              <p className="text-slate-500 text-sm max-w-md">
                Start by adding your platform handles, then hit <strong className="text-cyan-400">Sync Profiles</strong> to pull in your stats.
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm font-semibold
                         bg-gradient-to-r from-cyan-500/20 to-blue-600/20
                         border border-cyan-500/40 text-cyan-300
                         hover:border-cyan-400 transition-all"
            >
              <Settings size={15} />
              Set Up Handles
            </button>
          </motion.div>
        )}

        {/* ── Loading skeleton ───────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-800/50" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-72 rounded-2xl bg-slate-800/50" />
              ))}
            </div>
            <div className="h-52 rounded-xl bg-slate-800/50" />
          </div>
        )}

        {/* ── Populated dashboard ────────────────────────────────────────── */}
        {!loading && (dashboard || syncResult) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* ── Summary stat chips ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatChip
                icon={CheckCircle2}
                label="Total Solved"
                value={totalSolved}
                color="text-cyan-400"
              />
              <StatChip
                icon={TrendingUp}
                label="Peak Rating"
                value={maxRating || "—"}
                color="text-amber-400"
              />
              <StatChip
                icon={Activity}
                label="Active Days"
                value={heatmapData.filter((d) => d.problems_solved > 0).length}
                color="text-emerald-400"
              />
              <StatChip
                icon={Zap}
                label="Hard Solved"
                value={totalHard}
                color="text-red-400"
              />
            </div>

            {/* ── Tri-Force Platform Cards ────────────────────────────────── */}
            <div>
              <h2 className="font-mono font-semibold text-slate-400 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-slate-700" />
                Platform Stats
                <span className="flex-1 h-px bg-slate-800" />
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <PlatformCard
                  platform="leetcode"
                  stats={activeLc as PlatformStats | null}
                  index={0}
                />
                <PlatformCard
                  platform="codeforces"
                  stats={activeCf as PlatformStats | null}
                  index={1}
                />
                <PlatformCard
                  platform="codechef"
                  stats={activeCc as PlatformStats | null}
                  index={2}
                />
              </div>
            </div>

            {/* ── Bottom grid: Heatmap + Donut ───────────────────────────── */}
            <div>
              <h2 className="font-mono font-semibold text-slate-400 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-slate-700" />
                Progress Analytics
                <span className="flex-1 h-px bg-slate-800" />
              </h2>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Heatmap — takes 2/3 */}
                <div className="xl:col-span-2">
                  <Heatmap data={heatmapData} />
                </div>
                {/* Donut — takes 1/3 */}
                <div>
                  <DonutChart
                    easy={totalEasy}
                    medium={totalMedium}
                    hard={totalHard}
                  />
                </div>
              </div>
            </div>

            {/* ── Sync result details ─────────────────────────────────────── */}
            <AnimatePresence>
              {syncResult && syncState !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y:  0 }}
                  exit={{ opacity: 0 }}
                  className="panel p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-green-400" />
                    <h3 className="font-mono font-semibold text-slate-200 text-sm">
                      Last sync result
                    </h3>
                    <span className="text-xs text-slate-500 font-mono ml-auto">
                      {new Date(syncResult.synced_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                    {(["leetcode", "codeforces", "codechef"] as const).map((p) => {
                      const s = syncResult[p];
                      return (
                        <div key={p} className="space-y-1">
                          <div className="text-slate-500 capitalize">{p}</div>
                          {s.error ? (
                            <div className="text-red-400 text-xs">{s.error}</div>
                          ) : (
                            <>
                              <div className="text-slate-200">Rating: {s.rating.toLocaleString()}</div>
                              <div className="text-slate-400">Solved: {s.total_solved.toLocaleString()}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Quick links ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 pb-4">
              {[
                { label: "LeetCode",   href: handles.leetcode   ? `https://leetcode.com/${handles.leetcode}` : "https://leetcode.com" },
                { label: "Codeforces", href: handles.codeforces ? `https://codeforces.com/profile/${handles.codeforces}` : "https://codeforces.com" },
                { label: "CodeChef",   href: handles.codechef   ? `https://www.codechef.com/users/${handles.codechef}` : "https://www.codechef.com" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-mono text-slate-500
                             hover:text-slate-300 transition-colors"
                >
                  <ExternalLink size={11} />
                  {label} Profile
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* ── Handles modal ─────────────────────────────────────────────────── */}
      <HandlesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={handles}
        onSaved={(h) => {
          setModalOpen(false);
          if (dashboard) {
            setDashboard({
              ...dashboard,
              profile: {
                ...dashboard.profile,
                leetcode_handle:   h.leetcode   || null,
                codeforces_handle: h.codeforces || null,
                codechef_handle:   h.codechef   || null,
              },
            });
          }
        }}
      />
    </div>
  );
}
