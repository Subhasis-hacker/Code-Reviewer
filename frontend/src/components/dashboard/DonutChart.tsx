"use client";

import { motion } from "framer-motion";

interface Segment {
  label:  string;
  value:  number;
  color:  string;
  glow:   string;
  bg:     string;
  text:   string;
}

interface DonutChartProps {
  easy:   number;
  medium: number;
  hard:   number;
}

const SEGMENTS_CONFIG = [
  {
    label: "Easy",
    color: "#10b981",  // emerald-500
    glow:  "#10b98155",
    bg:    "bg-emerald-500/10",
    text:  "text-emerald-400",
    border:"border-emerald-500/30",
  },
  {
    label: "Medium",
    color: "#f59e0b",  // amber-500
    glow:  "#f59e0b55",
    bg:    "bg-amber-500/10",
    text:  "text-amber-400",
    border:"border-amber-500/30",
  },
  {
    label: "Hard",
    color: "#ef4444",  // red-500
    glow:  "#ef444455",
    bg:    "bg-red-500/10",
    text:  "text-red-400",
    border:"border-red-500/30",
  },
] as const;

const SIZE       = 180;
const STROKE     = 22;
const R          = (SIZE - STROKE) / 2;
const CIRCUM     = 2 * Math.PI * R;
const CENTER     = SIZE / 2;

export function DonutChart({ easy, medium, hard }: DonutChartProps) {
  const total = easy + medium + hard || 1; // avoid /0

  const segments: Segment[] = [
    { ...SEGMENTS_CONFIG[0], value: easy   },
    { ...SEGMENTS_CONFIG[1], value: medium },
    { ...SEGMENTS_CONFIG[2], value: hard   },
  ];

  // Compute arc offsets
  let cumulativePct = 0;
  const arcs = segments.map((seg) => {
    const pct    = seg.value / total;
    const dash   = CIRCUM * pct;
    const offset = CIRCUM * (1 - cumulativePct);
    cumulativePct += pct;
    return { ...seg, pct, dash, offset };
  });

  return (
    <div className="panel p-5">
      <h3 className="font-mono font-semibold text-slate-200 text-sm mb-4">
        Difficulty Breakdown
      </h3>

      <div className="flex items-center justify-center gap-8 flex-wrap">
        {/* SVG Donut */}
        <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {/* Track */}
            <circle
              cx={CENTER} cy={CENTER} r={R}
              fill="none"
              stroke="#1e2d50"
              strokeWidth={STROKE}
            />
            {/* Segments */}
            {arcs.map((arc, i) => (
              <motion.circle
                key={arc.label}
                cx={CENTER}
                cy={CENTER}
                r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeDasharray={`${arc.dash} ${CIRCUM - arc.dash}`}
                strokeDashoffset={arc.offset}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
                initial={{ strokeDasharray: `0 ${CIRCUM}` }}
                animate={{ strokeDasharray: `${arc.dash} ${CIRCUM - arc.dash}` }}
                transition={{ duration: 1.0, delay: i * 0.2, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${arc.glow})` }}
              />
            ))}
          </svg>

          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <motion.span
              className="font-mono font-bold text-2xl text-slate-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {(easy + medium + hard).toLocaleString()}
            </motion.span>
            <span className="text-xs text-slate-500 font-mono">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-3 min-w-[140px]">
          {arcs.map((arc) => (
            <div key={arc.label} className="flex items-center gap-3">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg ${arc.bg} border ${arc.border}
                            flex items-center justify-center`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: arc.color, boxShadow: `0 0 6px ${arc.glow}` }}
                />
              </div>
              <div>
                <div className={`font-mono font-bold text-base ${arc.text}`}>
                  {arc.value.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  {arc.label}
                  <span className="text-slate-600">
                    {Math.round(arc.pct * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
