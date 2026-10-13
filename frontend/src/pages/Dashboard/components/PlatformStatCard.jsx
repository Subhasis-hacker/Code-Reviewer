import { motion } from 'framer-motion';
import { Trophy, AlertCircle, TrendingUp, Award, Target } from 'lucide-react';

const platformConfig = {
  leetcode: {
    name: 'LeetCode',
    gradient: 'from-amber-500/20 to-orange-500/10',
    border: 'border-amber-500/20 hover:border-amber-400/40',
    accent: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/5',
  },
  codeforces: {
    name: 'Codeforces',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/20 hover:border-blue-400/40',
    accent: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    glow: 'shadow-blue-500/5',
  },
  codechef: {
    name: 'CodeChef',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-400/40',
    accent: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/5',
  },
};

export default function PlatformStatCard({ platform, data }) {
  const config = platformConfig[platform] || platformConfig.leetcode;

  const displayMetric = (key) => {
    if (data?.error && key !== 'handle') return null;
    const value = data?.[key];
    if (value === null || value === undefined) return null;
    return value;
  };

  const rating = displayMetric('rating');
  const maxRating = displayMetric('max_rating');
  const totalSolved = displayMetric('total_solved');
  const handle = data?.handle || '';
  const hasError = !!data?.error;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`
        relative overflow-hidden rounded-2xl border backdrop-blur-sm
        bg-gradient-to-br ${config.gradient} ${config.border}
        transition-all duration-300 shadow-lg ${config.glow}
        hover:shadow-xl
      `}
    >
      {/* Decorative background icon */}
      <div className="absolute -top-4 -right-4 opacity-[0.04]">
        <Trophy className="w-32 h-32" />
      </div>

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${config.iconBg} border border-white/5`}>
              <Award className={`w-5 h-5 ${config.accent}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">{config.name}</h3>
              {handle && (
                <p className="text-xs text-zinc-500 font-mono">@{handle}</p>
              )}
            </div>
          </div>
        </div>

        {hasError ? (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-300 leading-relaxed">{data.error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rating */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Current Rating</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-zinc-100 tabular-nums">
                    {rating !== null ? rating : <span className="text-zinc-600 text-lg font-normal italic">N/A</span>}
                  </span>
                  {maxRating !== null && maxRating !== rating && (
                    <span className="text-xs text-zinc-500">
                      (max: <span className="font-semibold text-zinc-400">{maxRating}</span>)
                    </span>
                  )}
                </div>
              </div>

              {/* Solved */}
              <div className="text-right">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Solved</p>
                <div className="flex items-center gap-1.5">
                  <Target className={`w-4 h-4 ${config.accent}`} />
                  <span className={`text-2xl font-bold ${config.accent} tabular-nums`}>
                    {totalSolved !== null ? totalSolved : <span className="text-zinc-600 text-base font-normal italic">N/A</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Rank / Stars */}
            {data?.rank && (
              <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">
                  {platform === 'codechef' && data.stars
                    ? `${data.stars} • `
                    : ''}
                  Rank: <span className="font-semibold text-zinc-300">{data.rank}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
