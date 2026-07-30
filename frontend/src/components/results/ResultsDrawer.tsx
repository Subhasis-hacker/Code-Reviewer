"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import type { ReviewResult } from "@/lib/types";
import { DiffViewer } from "./DiffViewer";

interface ResultsDrawerProps {
  result: ReviewResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ResultsDrawer({ result, isOpen, onClose }: ResultsDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && result && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] flex flex-col
                       bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-panel"
          >
            {/* Handle bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto" />
                <h2 className="font-mono font-semibold text-slate-200 text-base">
                  Review Results
                </h2>
                <span className="badge badge-green">
                  {Math.round(result.pass_rate * 100)}% pass rate
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6">
              <DiffViewer result={result} />
            </div>

            {/* Collapse hint */}
            <div className="flex-shrink-0 flex justify-center py-3 border-t border-slate-800">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
              >
                <ChevronDown size={14} />
                Close results
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
