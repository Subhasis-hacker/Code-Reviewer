import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Info, ChevronDown, ChevronUp, SortDesc } from 'lucide-react';

const BAR_COLOR = '#10b981';
const BAR_HOVER_COLOR = '#34d399';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold text-zinc-100 mb-1">{label}</p>
      <p className="text-xs text-zinc-400">
        <span className="font-bold text-emerald-400 text-sm">{payload[0].value}</span> problems solved
      </p>
    </div>
  );
};

export default function TopicHistogram({ topicsData }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_LIMIT = 12;

  if (!topicsData?.topics?.length) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-lg font-bold mb-4 text-zinc-100">Topic Distribution</h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-zinc-800/50 rounded-2xl mb-4">
            <SortDesc className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
            No topic data available yet. Sync your profiles to see which topics you've mastered across platforms.
          </p>
        </div>
      </div>
    );
  }

  const { topics, contributing_platforms, note } = topicsData;

  const displayTopics = showAll ? topics : topics.slice(0, INITIAL_LIMIT);
  const hasMore = topics.length > INITIAL_LIMIT;

  // Calculate max for bar scaling
  const maxCount = Math.max(...topics.map(t => t.count), 1);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-lg font-bold text-zinc-100">Topic Distribution</h3>
          <p className="text-xs text-zinc-500 mt-1">
            {topics.length} topics from{' '}
            {contributing_platforms?.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') || 'synced platforms'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-800/50 rounded-lg px-2.5 py-1.5">
          <SortDesc className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px] text-zinc-500">By count</span>
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="mt-5 space-y-1.5">
        {displayTopics.map((topic, i) => {
          const widthPct = Math.max((topic.count / maxCount) * 100, 2);
          return (
            <div
              key={topic.topic}
              className="flex items-center gap-3 group cursor-default"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-xs text-zinc-400 w-[140px] text-right truncate flex-shrink-0 group-hover:text-zinc-200 transition-colors">
                {topic.topic}
              </span>
              <div className="flex-1 h-7 bg-zinc-800/30 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-500 ease-out group-hover:brightness-125"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(90deg, rgba(16,185,129,0.6) 0%, rgba(16,185,129,0.3) 100%)`,
                  }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-zinc-300 tabular-nums">
                  {topic.count}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors mx-auto"
        >
          {showAll ? (
            <>Show fewer <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Show all {topics.length} topics <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}

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
