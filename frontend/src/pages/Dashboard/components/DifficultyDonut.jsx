import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertCircle, Info } from 'lucide-react';

const COLORS = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: data } = payload[0];
  return (
    <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-zinc-100 mb-1">{name}</p>
      <p className="text-xs text-zinc-400">
        <span className="font-bold text-zinc-200 text-sm">{value}</span> problems
        <span className="text-zinc-500 ml-1">({data.percentage}%)</span>
      </p>
    </div>
  );
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
  if (value === 0) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {value}
    </text>
  );
};

export default function DifficultyDonut({ totals }) {
  if (!totals) return null;

  const { easy, medium, hard, classified_total, unclassified_note } = totals;

  // Check if we have any real difficulty data
  const hasData = (easy || 0) + (medium || 0) + (hard || 0) > 0;

  if (!hasData) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-lg font-bold mb-4 text-zinc-100 flex items-center gap-2">
          Difficulty Distribution
        </h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-zinc-800/50 rounded-2xl mb-4">
            <AlertCircle className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
            No difficulty classification data available yet. 
            Sync your LeetCode profile to see the Easy / Medium / Hard breakdown.
          </p>
        </div>
      </div>
    );
  }

  const total = (easy || 0) + (medium || 0) + (hard || 0);
  const chartData = [
    { name: 'Easy', value: easy || 0, color: COLORS.Easy, percentage: total > 0 ? Math.round(((easy || 0) / total) * 100) : 0 },
    { name: 'Medium', value: medium || 0, color: COLORS.Medium, percentage: total > 0 ? Math.round(((medium || 0) / total) * 100) : 0 },
    { name: 'Hard', value: hard || 0, color: COLORS.Hard, percentage: total > 0 ? Math.round(((hard || 0) / total) * 100) : 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
      <h3 className="text-lg font-bold mb-1 text-zinc-100">Difficulty Distribution</h3>
      <p className="text-xs text-zinc-500 mb-4">Verified classifications from LeetCode</p>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Chart */}
        <div className="w-full lg:w-1/2 h-[240px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={65}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                content={<CustomLabel />}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-zinc-100">{total}</span>
            <span className="text-xs text-zinc-500">Classified</span>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full lg:w-1/2 space-y-3">
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between bg-white/[0.02] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm font-medium text-zinc-300">{entry.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-zinc-100 tabular-nums">{entry.value}</span>
                <span className="text-xs text-zinc-500 ml-2">({entry.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Limitation note */}
      {unclassified_note && (
        <div className="mt-4 flex items-start gap-2 bg-zinc-800/30 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-zinc-500 leading-relaxed">{unclassified_note}</p>
        </div>
      )}
    </div>
  );
}
