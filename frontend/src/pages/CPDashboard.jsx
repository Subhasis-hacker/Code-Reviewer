import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Link2, RefreshCw, ExternalLink, Trophy, CheckCircle2 } from 'lucide-react';
import { cpApi, errMsg } from '../api';
import HandleModal from '../components/HandleModal';
import { TopicRadar, RatingLines, Heatmap, PLATFORM_COLORS } from '../components/Charts';

const PLATFORMS = [
  { k: 'codeforces', name: 'Codeforces', text: 'text-cf', border: 'border-cf/30' },
  { k: 'leetcode', name: 'LeetCode', text: 'text-lc', border: 'border-lc/30' },
  { k: 'codechef', name: 'CodeChef', text: 'text-cc', border: 'border-cc/30' },
];

const Skeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-800/60" />)}</div>
    <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-80 rounded-2xl bg-slate-800/60" />)}</div>
    <div className="h-40 rounded-2xl bg-slate-800/60" />
  </div>
);

// Decorative, data-free shapes shown blurred behind the empty state.
function GhostCharts() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid gap-4 p-4 opacity-60 blur-md lg:grid-cols-2">
      <svg viewBox="0 0 200 120" className="h-full w-full"><polygon points="100,15 175,55 150,105 50,105 25,55" fill="#6366f1" fillOpacity=".3" stroke="#6366f1" /><polygon points="100,40 140,60 125,90 75,90 60,60" fill="#22d3ee" fillOpacity=".25" stroke="#22d3ee" /></svg>
      <svg viewBox="0 0 200 120" className="h-full w-full" fill="none" strokeWidth="2"><path d="M0 90 C40 80 60 30 100 50 S160 20 200 30" stroke="#22d3ee" /><path d="M0 100 C50 95 70 70 110 75 S170 55 200 60" stroke="#f59e0b" /><path d="M0 110 C40 100 90 100 130 90 S180 80 200 85" stroke="#10b981" /></svg>
    </div>
  );
}

export default function CPDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const s = await cpApi.stats();
      setStats(s.data || null);
    } catch (e) {
      setLoadError(errMsg(e, 'Could not load dashboard stats.'));
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sync = async (handles) => {
    setSyncing(true);
    try {
      const { data } = await cpApi.syncHandles(handles);
      toast.success(data?.message || 'Handles synced.');
      setModal(false);
      setLoading(true);
      await load();
    } catch (e) { toast.error(errMsg(e, 'Sync failed.')); }
    finally { setSyncing(false); }
  };

  // Expected (flexible) shape — see README: platforms{}, topics[], ratingHistory[], submissions[]
  // const view = useMemo(() => {
  //   const platforms = stats?.platforms || {};
  //   const topics = (stats?.topics || stats?.topic_mastery || []).map((t) => ({ topic: t.topic || t.name, score: Number(t.score ?? t.mastery ?? 0) }));
  //   const history = stats?.ratingHistory || stats?.rating_history || [];
  //   const keys = PLATFORMS.map((p) => p.k).filter((k) => history.some((h) => h[k] != null));
  //   const submissions = stats?.submissions || stats?.activity || [];
  //   const connected = PLATFORMS.some((p) => platforms[p.k] && (platforms[p.k].handle || platforms[p.k].rating != null || platforms[p.k].solved != null));
  //   const handles = Object.fromEntries(PLATFORMS.map((p) => [p.k, platforms[p.k]?.handle || '']));
  //   return { platforms, topics, history, keys, submissions, connected, handles };
  // }, [stats]);

  const view = useMemo(() => {
    // FIX: Pull the platform data directly from the root of the stats object
    const platforms = {
      leetcode: stats?.leetcode || null,
      codeforces: stats?.codeforces || null,
      codechef: stats?.codechef || null,
    };

    const topics = (stats?.topics || stats?.topic_mastery || []).map((t) => ({
      topic: t.topic || t.name,
      score: Number(t.score ?? t.mastery ?? 0)
    }));

    const history = stats?.ratingHistory || stats?.rating_history || [];

    // Make sure PLATFORMS array is available in scope (e.g., [{ k: 'leetcode' }, { k: 'codeforces' }, ...])
    const keys = PLATFORMS.map((p) => p.k).filter((k) => history.some((h) => h[k] != null));

    const submissions = stats?.submissions || stats?.activity || [];

    // Now that `platforms` correctly holds the Codeforces data, this will evaluate to true
    const connected = PLATFORMS.some((p) =>
      platforms[p.k] && (platforms[p.k].handle || platforms[p.k].rating != null || platforms[p.k].solved != null)
    );

    const handles = Object.fromEntries(PLATFORMS.map((p) => [p.k, platforms[p.k]?.handle || '']));

    return { platforms, topics, history, keys, submissions, connected, handles };
  }, [stats]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <button className="btn" onClick={() => setModal(true)}>{view.connected ? <RefreshCw size={16} /> : <Link2 size={16} />}{view.connected ? 'Manage handles' : 'Connect platforms'}</button>
      </div>
      {loading ? <Skeleton /> : loadError ? (
        <div className="panel text-center"><p className="text-rose-400">{loadError}</p><button className="btn-ghost mt-4" onClick={() => { setLoading(true); load(); }}>Retry</button></div>
      ) : !view.connected ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
          <GhostCharts />
          <div className="relative grid place-items-center px-6 py-24 text-center">
            <h2 className="text-2xl font-bold text-white">No platforms connected</h2>
            <p className="mt-2 max-w-md text-slate-400">Add your Codeforces, LeetCode or CodeChef handle to see topic mastery, rating history and submission activity.</p>
            <button className="btn mt-6" onClick={() => setModal(true)}><Link2 size={16} />Connect platforms</button>
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {PLATFORMS.map((p) => {
              const d = view.platforms[p.k]; return (
                <div key={p.k} className={`panel ${d ? p.border : 'opacity-50'}`}>
                  <div className={`text-sm font-medium ${p.text}`}>{p.name}</div>
                  {d ? (<>
                    <div className="mt-2 text-3xl font-bold text-white">{d.rating ?? '—'}</div>
                    <div className="mt-1 flex gap-3 text-xs text-slate-400">
                      {d.handle && <span className="font-mono">{d.handle}</span>}
                      {d.maxRating != null && <span className="flex items-center gap-1"><Trophy size={12} />max {d.maxRating}</span>}
                      {d.solved != null && <span className="flex items-center gap-1"><CheckCircle2 size={12} />{d.solved} solved</span>}
                    </div>
                  </>) : <div className="mt-2 text-sm text-slate-500">Not connected</div>}
                </div>);
            })}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel"><h2 className="mb-2 font-bold text-white">Topic mastery</h2>{view.topics.length ? <TopicRadar data={view.topics} /> : <p className="py-16 text-center text-sm text-slate-500">Topic data appears after more submissions are synced.</p>}</section>
            <section className="panel"><h2 className="mb-2 font-bold text-white">Rating trajectory</h2>{view.keys.length ? <RatingLines data={view.history} keys={view.keys} /> : <p className="py-16 text-center text-sm text-slate-500">No rated contests found yet.</p>}</section>
          </div>
          <section className="panel"><h2 className="mb-3 font-bold text-white">Recent activity</h2>{view.submissions.length ? <Heatmap submissions={view.submissions} /> : <p className="py-8 text-center text-sm text-slate-500">No recent submissions found.</p>}</section>
        </motion.div>
      )}
      <HandleModal open={modal} onClose={() => setModal(false)} initial={view.handles} onSubmit={sync} busy={syncing} />
    </>
  );
}
