"use client";

import { motion } from "framer-motion";

interface PassRateGaugeProps {
  rate: number; // 0.0 – 1.0
  size?: number;
}

export function PassRateGauge({ rate, size = 120 }: PassRateGaugeProps) {
  const pct      = Math.round(rate * 100);
  const radius   = (size - 16) / 2;
  const circum   = 2 * Math.PI * radius;
  const dash     = circum * rate;

  const color =
    rate >= 1.0  ? "#39ff14" :
    rate >= 0.75 ? "#00f5ff" :
    rate >= 0.5  ? "#ffb347" :
                   "#ff4757";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e2d50"
          strokeWidth={8}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circum}
          initial={{ strokeDashoffset: circum }}
          animate={{ strokeDashoffset: circum - dash }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      {/* Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-mono font-bold text-xl"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {pct}%
        </motion.span>
        <span className="text-slate-500 text-xs font-mono">pass</span>
      </div>
    </div>
  );
}
