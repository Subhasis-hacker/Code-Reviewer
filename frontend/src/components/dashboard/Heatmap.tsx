"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { HeatmapEntry } from "@/lib/cp_api";

interface HeatmapProps {
  data: HeatmapEntry[];
}

// 5 shades of emerald green (index 0 = empty)
const SHADES = [
  "bg-slate-800",          // 0  – no activity
  "bg-emerald-900",        // 1  – 1
  "bg-emerald-700",        // 2  – 2-3
  "bg-emerald-500",        // 3  – 4-6
  "bg-emerald-400",        // 4  – 7-9
  "bg-emerald-300",        // 5  – 10+
] as const;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["","Mon","","Wed","","Fri",""];

function shadeIndex(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3)  return 2;
  if (count <= 6)  return 3;
  if (count <= 9)  return 4;
  return 5;
}

/** Build a 53-week × 7-day grid for the last 365 days */
function buildGrid(data: HeatmapEntry[]): {
  weeks: { date: string; count: number }[][];
  monthLabels: { label: string; col: number }[];
} {
  const lookup = new Map(data.map((e) => [e.activity_date, e.problems_solved]));

  const today     = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);
  // Rewind to Sunday of that week
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: { date: string; count: number }[][] = [];
  const monthLabels: { label: string; col: number }[] = [];

  let current = new Date(startDate);
  let weekIdx = 0;

  while (current <= today || weekIdx < 53) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso   = current.toISOString().slice(0, 10);
      const count = current <= today ? (lookup.get(iso) ?? 0) : -1; // -1 = future
      week.push({ date: iso, count });

      // Track month label at the start of a new month in row 0
      if (d === 0 && current.getDate() <= 7) {
        monthLabels.push({ label: MONTHS[current.getMonth()], col: weekIdx });
      }

      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    weekIdx++;
    if (weekIdx > 52) break;
  }

  return { weeks, monthLabels };
}

export function Heatmap({ data }: HeatmapProps) {
  const { weeks, monthLabels } = useMemo(() => buildGrid(data), [data]);

  const totalDays    = data.length;
  const activeDays   = data.filter((d) => d.problems_solved > 0).length;
  const maxSolved    = data.reduce((m, d) => Math.max(m, d.problems_solved), 0);
  const totalSolved  = data.reduce((s, d) => s + d.problems_solved, 0);

  return (
    <div className="panel p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-mono font-semibold text-slate-200 text-sm">
            Contribution Heatmap
          </h3>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            {activeDays} active days · {totalSolved} problems solved in the last year
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
          <span>Less</span>
          {SHADES.map((s, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-sm ${s}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-max">
          {/* Month labels row */}
          <div className="flex mb-1 ml-7">
            {monthLabels.map(({ label, col }) => (
              <div
                key={`${label}-${col}`}
                className="text-xs text-slate-500 font-mono"
                style={{ width: `${(col + 1) * 14}px`, position: "relative" }}
              >
                <span className="absolute left-0">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-0.5">
            {/* Day labels column */}
            <div className="flex flex-col gap-0.5 mr-1.5 mt-0.5">
              {DAYS.map((day, i) => (
                <div key={i} className="h-3 text-xs text-slate-600 font-mono leading-3 w-5 text-right">
                  {day}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map(({ date, count }, di) => {
                  const shade = count < 0 ? "bg-transparent" : SHADES[shadeIndex(count)];
                  return (
                    <motion.div
                      key={`${wi}-${di}`}
                      className={`w-3 h-3 rounded-sm cursor-default ${shade} transition-colors`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (wi * 7 + di) * 0.001, duration: 0.15 }}
                      title={count >= 0 ? `${date}: ${count} solved` : ""}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
        <div className="text-center">
          <div className="font-mono font-bold text-emerald-400 text-lg">{activeDays}</div>
          <div className="text-xs text-slate-500 font-mono">Active Days</div>
        </div>
        <div className="text-center">
          <div className="font-mono font-bold text-emerald-400 text-lg">{totalSolved}</div>
          <div className="text-xs text-slate-500 font-mono">Problems</div>
        </div>
        <div className="text-center">
          <div className="font-mono font-bold text-emerald-400 text-lg">{maxSolved}</div>
          <div className="text-xs text-slate-500 font-mono">Best Day</div>
        </div>
      </div>
    </div>
  );
}
