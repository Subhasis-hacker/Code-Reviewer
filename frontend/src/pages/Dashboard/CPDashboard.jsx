import { useState, useEffect } from 'react';
import { cpAPI } from '../../services/api';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Trophy,
  Code2,
  Target,
  TrendingUp,
  Activity,
  Zap,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const COLORS = {
  easy: '#34d399',
  medium: '#fbbf24',
  hard: '#fb7185',
};

const PLATFORMS = [
  { key: 'leetcode', name: 'LeetCode', color: '#f59e0b' },
  { key: 'codeforces', name: 'Codeforces', color: '#60a5fa' },
  { key: 'codechef', name: 'CodeChef', color: '#c084fc' },
];

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : value;
};

const getNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function StatCard({ title, value, description, icon: Icon, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-zinc-700"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.08] blur-2xl"
        style={{ backgroundColor: color }}
      />

      <div className="relative flex items-center justify-between">
        <p className="text-sm text-zinc-400">{title}</p>
        <div className="rounded-xl border border-zinc-700/70 bg-zinc-800/80 p-2.5">
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>

      <p className="relative mt-5 text-3xl font-bold tracking-tight text-white">
        {value}
      </p>

      <p className="relative mt-2 text-xs text-zinc-500">{description}</p>
    </motion.div>
  );
}

function Section({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 md:p-6 ${className}`}
    >
      <div className="mb-5">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3 text-center">
      <Activity className="h-8 w-8 text-zinc-600" />
      <p className="max-w-xs text-sm text-zinc-500">{message}</p>
    </div>
  );
}

export default function CPDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [loadError, setLoadError] = useState('');

  const [handles, setHandles] = useState({
    leetcode_handle: '',
    codeforces_handle: '',
    codechef_handle: '',
  });

  const loadStats = async () => {
    try {
      setLoadError('');
      const response = await cpAPI.getStats();
      const result = response.data;

      setData(result);
      setHandles({
        leetcode_handle: result?.handles?.leetcode || '',
        codeforces_handle: result?.handles?.codeforces || '',
        codechef_handle: result?.handles?.codechef || '',
      });
    } catch (error) {
      console.error('Failed to load CP dashboard:', error);
      setLoadError(
        error.response?.data?.detail || 'Unable to load dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleSync = async (event) => {
    event.preventDefault();
    setSyncing(true);
    setSyncError('');

    try {
      await cpAPI.syncHandles(handles);
      // Fetch the canonical dashboard response after syncing.
      await loadStats();
    } catch (error) {
      const detail = error.response?.data?.detail;
      setSyncError(
        typeof detail === 'string'
          ? detail
          : 'Unable to sync profiles. Please verify your handles.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const platformData = PLATFORMS.map((platform) => {
    const profile = data?.[platform.key];
    const unavailable = !profile || Boolean(profile.error);

    const rating = unavailable
      ? null
      : getNumericValue(profile.rating);

    const solved = unavailable
      ? null
      : getNumericValue(profile.total_solved);

    return {
      ...platform,
      rating,
      solved,
      error: profile?.error,
      unavailable,
    };
  });

  const totals = data?.totals || {};
  const easy = getNumericValue(totals.easy) ?? 0;
  const medium = getNumericValue(totals.medium) ?? 0;
  const hard = getNumericValue(totals.hard) ?? 0;

  const difficultyData = [
    { name: 'Easy', value: easy, color: COLORS.easy },
    { name: 'Medium', value: medium, color: COLORS.medium },
    { name: 'Hard', value: hard, color: COLORS.hard },
  ];

  const difficultyTotal = difficultyData.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const availableSolved = platformData.filter(
    (platform) => platform.solved !== null
  );

  const reportedSolvedTotal = availableSolved.reduce(
    (sum, platform) => sum + platform.solved,
    0
  );

  const availableRatings = platformData.filter(
    (platform) => platform.rating !== null
  );

  const maxRating = Math.max(
    1,
    ...availableRatings.map((platform) => platform.rating)
  );

  const maxSolved = Math.max(
    1,
    ...availableSolved.map((platform) => platform.solved)
  );

  const assessment =
    availableRatings.length === 0 && availableSolved.length === 0
      ? {
          title: 'Awaiting profile data',
          description: 'Sync your coding profiles to view your stats.',
          color: 'text-zinc-300',
        }
      : {
          title: 'Your coding profile',
          description:
            'Review your platform ratings, practice volume, and difficulty distribution to understand your current strengths.',
          color: 'text-emerald-400',
        };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-3 text-zinc-400">
        <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
        Loading your analytics...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-emerald-950/70 via-zinc-900 to-zinc-950 p-6 md:p-8"
        >
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium tracking-wide text-emerald-300">
                <Zap className="h-3.5 w-3.5" />
                ALGORITHM PERFORMANCE CENTER
              </div>

              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                CP Analytics
              </h1>

              <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400 md:text-base">
                Your competitive programming journey, visualized across all
                your coding platforms.
              </p>
            </div>

            <form
              onSubmit={handleSync}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {PLATFORMS.map((platform) => {
                const handleKey = `${platform.key}_handle`;

                return (
                  <label
                    key={platform.key}
                    className="text-xs font-medium text-zinc-400"
                  >
                    {platform.name}
                    <input
                      type="text"
                      value={handles[handleKey]}
                      onChange={(event) =>
                        setHandles((previous) => ({
                          ...previous,
                          [handleKey]: event.target.value,
                        }))
                      }
                      placeholder="Your handle"
                      className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
                    />
                  </label>
                );
              })}

              <button
                type="submit"
                disabled={syncing}
                className="flex min-h-10 items-center justify-center gap-2 self-end rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
                />
                {syncing ? 'Syncing...' : 'Sync profiles'}
              </button>
            </form>
          </div>

          {syncError && (
            <div className="relative mt-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {syncError}
            </div>
          )}

          {loadError && (
            <div className="relative mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={loadStats}
                className="underline"
              >
                Retry
              </button>
            </div>
          )}
        </motion.header>

        {data && (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Reported solved total"
                value={formatNumber(reportedSolvedTotal)}
                description="Sum of available platform totals; duplicates may exist"
                icon={Code2}
                color="#34d399"
                delay={0.05}
              />
              <StatCard
                title="Profiles available"
                value={`${platformData.filter((p) => !p.unavailable).length}/3`}
                description="Profiles without a reported platform error"
                icon={ShieldCheck}
                color="#60a5fa"
                delay={0.1}
              />
              <StatCard
                title="Easy problems"
                value={formatNumber(easy)}
                description="Difficulty total returned by your API"
                icon={Target}
                color={COLORS.easy}
                delay={0.15}
              />
              <StatCard
                title="Hard problems"
                value={formatNumber(hard)}
                description="Difficulty total returned by your API"
                icon={TrendingUp}
                color={COLORS.hard}
                delay={0.2}
              />
            </div>

            {/* Assessment */}
            <section className="flex flex-col gap-4 rounded-2xl border border-emerald-500/15 bg-gradient-to-r from-emerald-950/30 to-zinc-900/60 p-5 sm:flex-row sm:items-center md:p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                <Trophy className="h-7 w-7 text-emerald-400" />
              </div>

              <div className="flex-1">
                <h2 className={`text-lg font-bold ${assessment.color}`}>
                  {assessment.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  {assessment.description}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Activity className="h-4 w-4" />
                Based on available profile data
              </div>
            </section>

            {/* Platform cards */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-bold">Platform overview</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Each platform uses its own rating scale.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {platformData.map((platform, index) => (
                  <motion.div
                    key={platform.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    whileHover={{ y: -4 }}
                    className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-zinc-700"
                  >
                    <div
                      className="absolute left-0 top-0 h-1 w-full opacity-80"
                      style={{ backgroundColor: platform.color }}
                    />

                    <div className="flex items-center justify-between pt-1">
                      <h3 className="font-semibold text-zinc-200">
                        {platform.name}
                      </h3>
                      <Trophy
                        className="h-5 w-5"
                        style={{ color: platform.color }}
                      />
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-zinc-500">Current rating</p>
                        <p className="mt-1 text-2xl font-bold text-white">
                          {formatNumber(platform.rating)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Problems solved</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-400">
                          {formatNumber(platform.solved)}
                        </p>
                      </div>
                    </div>

                    {platform.solved !== null && (
                      <div className="mt-5">
                        <div className="mb-2 flex justify-between text-xs text-zinc-500">
                          <span>Relative solved count</span>
                          <span>
                            {Math.round(
                              (platform.solved / maxSolved) * 100
                            )}
                            %
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(platform.solved / maxSolved) * 100}%`,
                            }}
                            transition={{ duration: 0.8 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: platform.color }}
                          />
                        </div>
                      </div>
                    )}

                    {platform.error && (
                      <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {platform.error}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Section
                title="Difficulty breakdown"
                subtitle="Distribution of difficulty counts returned by your backend."
              >
                {difficultyTotal > 0 ? (
                  <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                    <div className="relative h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={difficultyData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={66}
                            outerRadius={94}
                            paddingAngle={4}
                            stroke="none"
                          >
                            {difficultyData.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#18181b',
                              border: '1px solid #3f3f46',
                              borderRadius: '12px',
                              color: '#f4f4f5',
                            }}
                            formatter={(value) => formatNumber(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-white">
                          {formatNumber(difficultyTotal)}
                        </span>
                        <span className="mt-1 text-xs text-zinc-500">
                          Classified
                        </span>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {difficultyData.map((item) => {
                        const percentage =
                          difficultyTotal > 0
                            ? (item.value / difficultyTotal) * 100
                            : 0;

                        return (
                          <div key={item.name}>
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-sm text-zinc-400">
                                  {item.name}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-white">
                                {formatNumber(item.value)}
                              </span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>

                            <p className="mt-1.5 text-right text-xs text-zinc-600">
                              {percentage.toFixed(1)}%
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyChart message="Difficulty counts are unavailable or zero in the current API response." />
                )}
              </Section>

              <Section
                title="Platform rating comparison"
                subtitle="Compare the numeric ratings currently available from each platform."
              >
                {availableRatings.length > 0 ? (
                  <>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={availableRatings}
                          margin={{ top: 10, right: 8, left: -15, bottom: 0 }}
                        >
                          <CartesianGrid
                            stroke="#27272a"
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: '#71717a', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: '#27272a', opacity: 0.5 }}
                            contentStyle={{
                              backgroundColor: '#18181b',
                              border: '1px solid #3f3f46',
                              borderRadius: '12px',
                            }}
                            formatter={(value) => formatNumber(value)}
                          />
                          <Bar dataKey="rating" name="Rating" radius={[7, 7, 0, 0]}>
                            {availableRatings.map((platform) => (
                              <Cell
                                key={platform.key}
                                fill={platform.color}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-zinc-600">
                      Note: rating systems are different across platforms.
                      The bars compare reported values, not equivalent skill
                      levels or official ranks.
                    </p>
                  </>
                ) : (
                  <EmptyChart message="No platform rating values are available in the current response." />
                )}
              </Section>
            </div>

            {/* Solved counts histogram */}
            <Section
              title="Problems solved by platform"
              subtitle="A visual comparison of the solved counts already returned by your API."
            >
              {availableSolved.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={availableSolved}
                      margin={{ top: 10, right: 12, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid
                        stroke="#27272a"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#a1a1aa', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: '#27272a', opacity: 0.5 }}
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '12px',
                        }}
                        formatter={(value) => formatNumber(value)}
                      />
                      <Bar
                        dataKey="solved"
                        name="Problems solved"
                        radius={[7, 7, 0, 0]}
                      >
                        {availableSolved.map((platform) => (
                          <Cell
                            key={platform.key}
                            fill={platform.color}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart message="No solved counts are available yet. Sync your profiles and try again." />
              )}
            </Section>

            {/* Summary */}
            <Section
              title="Your current snapshot"
              subtitle="A quick summary derived only from the currently available profile data."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-zinc-400">
                    <Code2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm">Practice volume</span>
                  </div>
                  <p className="text-xl font-bold text-white">
                    {formatNumber(reportedSolvedTotal)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    Combined reported total. The same problem may appear on
                    more than one platform.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-zinc-400">
                    <Target className="h-4 w-4 text-amber-400" />
                    <span className="text-sm">Difficulty coverage</span>
                  </div>
                  <p className="text-xl font-bold text-white">
                    {formatNumber(medium)} medium
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    Use the difficulty split to check whether your practice
                    is balanced across easy, medium, and hard problems.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-zinc-400">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    <span className="text-sm">Rating visibility</span>
                  </div>
                  <p className="text-xl font-bold text-white">
                    {availableRatings.length} of 3
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    Platforms with available rating values in the current
                    response.
                  </p>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
