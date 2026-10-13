import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, RefreshCw } from 'lucide-react';

const FIELDS = [
  { k: 'codeforces', label: 'Codeforces handle', color: 'text-cf' },
  { k: 'leetcode', label: 'LeetCode username', color: 'text-lc' },
  { k: 'codechef', label: 'CodeChef username', color: 'text-cc' },
];

export default function HandleModal({ open, onClose, initial, onSubmit, busy }) {
  const [vals, setVals] = useState({ leetcode: '', codeforces: '', codechef: '' });
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setVals({ leetcode: '', codeforces: '', codechef: '', ...initial }); setError(''); } }, [open]); // eslint-disable-line

  const submit = (e) => {
    e.preventDefault();
    const clean = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v.trim()]));
    if (!Object.values(clean).some(Boolean)) return setError('Enter at least one handle.');
    onSubmit(clean);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
          <motion.form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Manage handles" initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="panel w-full max-w-md space-y-4 bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Connect your platforms</h2>
              <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            {FIELDS.map(({ k, label, color }) => (
              <label key={k} className="block">
                <span className={`mb-1.5 block text-sm ${color}`}>{label}</span>
                <input className="input" value={vals[k]} onChange={(e) => { setVals({ ...vals, [k]: e.target.value }); setError(''); }} placeholder="Leave blank to skip" autoComplete="off" />
              </label>
            ))}
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button className="btn w-full" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{busy ? 'Syncing…' : 'Sync handles'}</button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
