"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Loader2, Cpu, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  const handleGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options:  { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 grid-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center mb-4">
            <Cpu size={26} className="text-cyan-400" />
          </div>
          <h1 className="font-mono font-bold text-2xl text-slate-100">AlgoReviewer</h1>
          <p className="text-slate-500 text-sm font-mono mt-1">Sign in to your dashboard</p>
        </div>

        <div className="panel p-6 space-y-4">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-4 text-center"
            >
              <CheckCircle2 size={40} className="text-emerald-400" />
              <p className="font-mono text-slate-200 text-sm font-semibold">Check your email!</p>
              <p className="text-slate-500 text-xs font-mono">
                We sent a magic link to <span className="text-cyan-400">{email}</span>
              </p>
            </motion.div>
          ) : (
            <>
              {/* GitHub OAuth */}
              <button
                onClick={handleGitHub}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                           bg-slate-800 border border-slate-700 hover:border-slate-600
                           text-slate-200 font-mono text-sm font-medium transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-slate-600 text-xs font-mono">or</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Magic link */}
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1.5 uppercase tracking-widest">
                  Email
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700
                               font-mono text-sm text-slate-200 placeholder-slate-600
                               focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20
                               transition-colors"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs font-mono bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                  {error}
                </p>
              )}

              <button
                onClick={handleMagicLink}
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                           font-mono text-sm font-semibold transition-all duration-200
                           disabled:opacity-40 disabled:cursor-not-allowed
                           bg-gradient-to-r from-cyan-500/20 to-blue-600/20
                           border border-cyan-500/40 text-cyan-300
                           hover:border-cyan-400"
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  : "Send Magic Link"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
