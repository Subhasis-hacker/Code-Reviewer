"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Loader2, CheckCircle2 } from "lucide-react";
import { saveHandles } from "@/lib/cp_api";

interface HandlesModalProps {
  isOpen:  boolean;
  onClose: () => void;
  initial: {
    leetcode:   string;
    codeforces: string;
    codechef:   string;
  };
  onSaved: (handles: { leetcode: string; codeforces: string; codechef: string }) => void;
}

export function HandlesModal({ isOpen, onClose, initial, onSaved }: HandlesModalProps) {
  const [lc, setLc] = useState(initial.leetcode);
  const [cf, setCf] = useState(initial.codeforces);
  const [cc, setCc] = useState(initial.codechef);

  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await saveHandles({
        leetcode_handle:   lc.trim()  || undefined,
        codeforces_handle: cf.trim()  || undefined,
        codechef_handle:   cc.trim()  || undefined,
      });
      setSuccess(true);
      onSaved({ leetcode: lc.trim(), codeforces: cf.trim(), codechef: cc.trim() });
      setTimeout(onClose, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    {
      label:       "LeetCode Handle",
      placeholder: "e.g. neal_wu",
      value:       lc,
      onChange:    setLc,
      accent:      "border-amber-500/40 focus:border-amber-400",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#ffa116">
          <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.396c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.396a3.021 3.021 0 0 1-4.263.02L4.917 9.113a2.012 2.012 0 0 1-.074-2.828l3.854-4.127 3.497-3.746A1.374 1.374 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H19.7a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z"/>
        </svg>
      ),
    },
    {
      label:       "Codeforces Handle",
      placeholder: "e.g. tourist",
      value:       cf,
      onChange:    setCf,
      accent:      "border-sky-500/40 focus:border-sky-400",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#1da1f2">
          <path d="M4.5 7.5C5.328 7.5 6 8.172 6 9v10.5c0 .828-.672 1.5-1.5 1.5h-3C.672 21 0 20.328 0 19.5V9c0-.828.672-1.5 1.5-1.5h3zm9.5-5C14.828 2.5 15.5 3.172 15.5 4v15.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V4c0-.828.672-1.5 1.5-1.5h3zm9.5 9c.828 0 1.5.672 1.5 1.5v6.5c0 .828-.672 1.5-1.5 1.5h-3c-.828 0-1.5-.672-1.5-1.5V13c0-.828.672-1.5 1.5-1.5h3z"/>
        </svg>
      ),
    },
    {
      label:       "CodeChef Handle",
      placeholder: "e.g. gennady",
      value:       cc,
      onChange:    setCc,
      accent:      "border-orange-500/40 focus:border-orange-400",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#c07b40">
          <path d="M11.257.004C5.056.265-.178 5.624.007 11.997c.185 6.372 5.668 11.52 12.04 11.335 6.367-.185 11.516-5.668 11.332-12.04C23.193 5.12 17.784-.264 11.257.004zm-.815 4.706l.206 2.872-1.762 2.119-2.547-.588.494-2.825 3.61-1.578zm3.397 1.578 3.61 1.578.494 2.825-2.547.588-1.762-2.119.205-2.872zM5.544 12.23l2.069-1.269 2.259 2.715v2.528L7.41 17.29 5.544 12.23zm12.912 0L16.59 17.29l-2.463-1.085v-2.528l2.26-2.715 2.069 1.269zM10.96 15.66l1.04-.453 1.04.453.478 2.585-1.518 1.004-1.518-1.004.478-2.585z"/>
        </svg>
      ),
    },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-700
                         bg-slate-900 shadow-panel overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <h2 className="font-mono font-bold text-slate-100 text-base">
                    Platform Handles
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Your usernames on each CP platform
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {fields.map((f) => (
                  <div key={f.label}>
                    <label className="block text-xs font-mono text-slate-500 mb-1.5 uppercase tracking-widest">
                      {f.label}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {f.icon}
                      </div>
                      <input
                        type="text"
                        value={f.value}
                        onChange={(e) => f.onChange(e.target.value)}
                        placeholder={f.placeholder}
                        className={`w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-800 border
                                   font-mono text-sm text-slate-200 placeholder-slate-600
                                   focus:outline-none focus:ring-1 focus:ring-offset-0
                                   transition-colors ${f.accent}`}
                      />
                    </div>
                  </div>
                ))}

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-400 text-xs font-mono bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5">
                <button
                  onClick={handleSave}
                  disabled={saving || success}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                             font-mono text-sm font-semibold transition-all duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed
                             bg-gradient-to-r from-cyan-500/20 to-blue-600/20
                             border border-cyan-500/40 text-cyan-300
                             hover:border-cyan-400 hover:text-cyan-100"
                >
                  {saving  ? <><Loader2 size={15} className="animate-spin" /> Saving…</> :
                   success ? <><CheckCircle2 size={15} className="text-green-400" /> Saved!</> :
                             <><Save size={15} /> Save Handles</>}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
