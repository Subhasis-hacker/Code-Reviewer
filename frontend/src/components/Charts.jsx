import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const tip = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 };
export const PLATFORM_COLORS = { codeforces: '#22d3ee', leetcode: '#f59e0b', codechef: '#10b981' };

export function TopicRadar({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#1e293b" />
        <PolarAngleAxis dataKey="topic" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
        <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
        <Tooltip contentStyle={tip} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function RatingLines({ data, keys }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ left: -10, right: 10 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#1e293b" />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} stroke="#1e293b" domain={['auto', 'auto']} />
        <Tooltip contentStyle={tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k) => <Line key={k} type="monotone" dataKey={k} stroke={PLATFORM_COLORS[k] || '#6366f1'} strokeWidth={2} dot={false} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

// submissions: [{ date: 'YYYY-MM-DD', count: number }]
export function Heatmap({ submissions }) {
  const counts = new Map(submissions.map((s) => [String(s.date).slice(0, 10), Number(s.count) || 0]));
  const weeks = 26, today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - (weeks * 7 - 1) - start.getDay());
  const max = Math.max(1, ...counts.values());
  const shade = (n) => (n === 0 ? 'bg-slate-800/70' : n / max > 0.66 ? 'bg-indigo-400' : n / max > 0.33 ? 'bg-indigo-500/70' : 'bg-indigo-500/40');
  const cols = [];
  for (let w = 0; w <= weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (day > today) { col.push(null); continue; }
      const key = day.toLocaleDateString('en-CA');
      col.push({ key, n: counts.get(key) || 0 });
    }
    cols.push(col);
  }
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1">
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((c, j) => c ? <div key={j} title={`${c.key}: ${c.n} submission${c.n === 1 ? '' : 's'}`} className={`h-3 w-3 rounded-sm ${shade(c.n)}`} /> : <div key={j} className="h-3 w-3" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
