import { useState, useEffect } from 'react';
import { cpAPI } from '../../services/api';
import { motion } from 'framer-motion';
import { Settings, RefreshCw, Trophy } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function CPDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [handles, setHandles] = useState({ leetcode_handle: '', codeforces_handle: '', codechef_handle: '' });

  const loadStats = async () => {
    try {
      const res = await cpAPI.getStats();
      setData(res.data);
      setHandles({
        leetcode_handle: res.data.handles.leetcode || '',
        codeforces_handle: res.data.handles.codeforces || '',
        codechef_handle: res.data.handles.codechef || ''
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const handleSync = async (e) => {
    e.preventDefault();
    setSyncing(true);
    try {
      const res = await cpAPI.syncHandles(handles);
      setData(res.data);
    } catch (err) {
      alert("Sync failed. Check handles.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="p-8 text-zinc-400 flex items-center justify-center gap-3 h-full"><RefreshCw className="animate-spin" /> Fetching Subroutines...</div>;

  const chartData = data ? [
    { name: 'Easy', value: data.totals.easy, color: '#10b981' },
    { name: 'Medium', value: data.totals.medium, color: '#f59e0b' },
    { name: 'Hard', value: data.totals.hard, color: '#ef4444' }
  ] : [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-zinc-100">CP Analytics</h1>
          <p className="text-zinc-400">Cross-platform algorithm proficiency.</p>
        </div>
        
        <form onSubmit={handleSync} className="flex flex-wrap items-end gap-3">
          {['leetcode', 'codeforces', 'codechef'].map(plat => (
            <div key={plat}>
              <label className="block text-xs text-zinc-500 mb-1 capitalize">{plat}</label>
              <input 
                type="text" placeholder="Handle"
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 w-32"
                value={handles[`${plat}_handle`]} 
                onChange={e => setHandles({...handles, [`${plat}_handle`]: e.target.value})}
              />
            </div>
          ))}
          <button type="submit" disabled={syncing} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-500/20 transition-colors h-[38px]">
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />} Sync
          </button>
        </form>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['leetcode', 'codeforces', 'codechef'].map(plat => (
              <motion.div key={plat} whileHover={{ y: -5 }} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Trophy className="w-24 h-24" /></div>
                <h3 className="text-lg font-bold capitalize text-zinc-300 mb-4">{plat}</h3>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-zinc-500">Current Rating</p>
                    <p className="text-4xl font-black text-zinc-100">{data[plat].rating || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Solved</p>
                    <p className="text-xl font-bold text-emerald-400">{data[plat].total_solved || 0}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 h-[400px]">
            <h3 className="text-lg font-bold mb-4 text-zinc-100">Aggregated Difficulty Split</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} itemStyle={{ color: '#e4e4e7' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}