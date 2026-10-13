import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area, AreaChart
} from 'recharts';
import { TrendingUp, BarChart3, Info } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-zinc-500 mb-1.5">
        {new Date(label + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        })}
      </p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs text-zinc-400">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-bold text-zinc-200">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function DailyGrowthChart({ progressData }) {
  const [mode, setMode] = useState('cumulative'); // 'daily' or 'cumulative'

  const { progress, note, earliest_record, range_days } = progressData || {};

  const chartData = useMemo(() => {
    if (!progress?.length) return [];

    return progress.map(p => ({
      date: p.date,
      displayDate: new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daily: p.daily_solved,
      cumulative: p.cumulative_solved,
    }));
  }, [progress]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const totalNew = chartData.reduce((sum, d) => sum + d.daily, 0);
    const activeDays = chartData.filter(d => d.daily > 0).length;
    const maxDaily = Math.max(...chartData.map(d => d.daily));
    const latestCumulative = chartData[chartData.length - 1]?.cumulative || 0;
    return { totalNew, activeDays, maxDaily, latestCumulative };
  }, [chartData]);

  if (!chartData.length) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-lg font-bold mb-4 text-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Growth Tracker
        </h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-zinc-800/50 rounded-2xl mb-4">
            <TrendingUp className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
            No progress data available yet. Sync your profiles to start tracking your daily solving growth.
          </p>
        </div>
      </div>
    );
  }

  // Smart tick interval based on data range
  const tickInterval = chartData.length > 90 ? 13 : chartData.length > 30 ? 6 : 3;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Growth Tracker
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Last {range_days || chartData.length} days
            {earliest_record && <span> · Tracking since {new Date(earliest_record + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex bg-zinc-800/50 rounded-xl p-0.5 border border-zinc-700/30">
          <button
            onClick={() => setMode('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'daily'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Daily
          </button>
          <button
            onClick={() => setMode('cumulative')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'cumulative'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Cumulative
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total New', value: stats.totalNew },
            { label: 'Active Days', value: stats.activeDays },
            { label: 'Best Day', value: stats.maxDaily },
            { label: 'Current Total', value: stats.latestCumulative },
          ].map(stat => (
            <div key={stat.label} className="bg-white/[0.02] rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-zinc-100 tabular-nums">{stat.value}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'cumulative' ? (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="displayDate"
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Solved"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#cumulativeGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#10b981', stroke: '#09090b', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="displayDate"
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="daily"
                name="Daily Solved"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#dailyGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#f59e0b', stroke: '#09090b', strokeWidth: 2 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Note */}
      {note && (
        <div className="mt-4 flex items-start gap-2 bg-zinc-800/30 rounded-lg px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-zinc-500 leading-relaxed">{note}</p>
        </div>
      )}
    </div>
  );
}
