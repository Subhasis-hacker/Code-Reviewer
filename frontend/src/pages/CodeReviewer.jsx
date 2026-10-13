import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Square, RotateCcw, Loader2, Code2, LayoutDashboard, History, Trash2, FastForward } from 'lucide-react';
import { useReview, estTokens, CHUNK_CHARS, MAX_INPUT_CHARS } from '../context/ReviewContext';

export default function CodeReviewer() {
  const { draft, setDraft, run, running, history, start, stop, resume, reset, loadHistory, removeHistory } = useReview();
  const outRef = useRef(null);
  const tokens = estTokens(draft.code);
  const parts = Math.max(1, Math.ceil(draft.code.length / CHUNK_CHARS));
  const tooBig = draft.code.length > MAX_INPUT_CHARS;
  const paused = run && (run.status === 'error' || run.status === 'stopped');
  const multi = run && run.parts.length > 1;

  useEffect(() => { if (running && outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; }, [run, running]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Code Reviewer</h1>
          <p className="text-sm text-slate-500">Paste a solution for algorithmic review. Long files are reviewed in parts automatically.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard" className="btn-ghost"><LayoutDashboard size={16} />Dashboard</Link>
          <button className="btn-ghost" onClick={reset} disabled={!draft.code && !run}><RotateCcw size={16} />New session</button>
          {running
            ? <button className="btn !bg-rose-500 hover:!bg-rose-400" onClick={stop}><Square size={16} />Stop</button>
            : <button className="btn" onClick={start} disabled={!draft.code.trim() || tooBig}><Play size={16} />Run analysis</button>}
        </div>
      </header>

      <div className="grid min-h-[60vh] gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <input className="input" placeholder="Problem description (optional)" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
          <textarea className="input min-h-[50vh] flex-1 resize-none font-mono" spellCheck={false} placeholder="Paste your code here…" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          <div className={`flex justify-between font-mono text-xs ${tooBig ? 'text-rose-400' : 'text-slate-500'}`}>
            <span>{draft.code.split('\n').length} lines · ~{tokens.toLocaleString()} tokens</span>
            <span>{tooBig ? `Too long: max ~${(MAX_INPUT_CHARS / 4000).toFixed(0)}k tokens` : parts > 1 ? `Will run as ${parts} parts` : 'Single request'}</span>
          </div>
        </section>

        <section className="panel flex min-h-0 flex-col">
          {run && (
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-800 pb-3 text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                {running && <Loader2 size={14} className="animate-spin text-indigo-400" />}
                {running ? (multi ? `Analyzing part ${run.idx + 1} of ${run.parts.length}` : 'Analyzing…') : run.status === 'done' ? 'Review complete' : run.status === 'stopped' ? 'Stopped' : 'Interrupted'}
              </span>
              {paused && multi && <button className="btn !px-3 !py-1.5" onClick={resume}><FastForward size={14} />Continue from part {run.idx + 1}</button>}
              {paused && !multi && <button className="btn !px-3 !py-1.5" onClick={start}><RotateCcw size={14} />Retry</button>}
            </div>
          )}
          {run?.note && <p className="mb-2 text-xs text-amber-400">{run.note}</p>}
          {run?.status === 'error' && <p className="mb-2 text-sm text-rose-400">{run.error}</p>}
          <div ref={outRef} className="max-h-[65vh] flex-1 overflow-y-auto">
            {run && run.results.some(Boolean) ? run.results.map((r, i) => r && (
              <div key={i} className="mb-5">
                {multi && <div className="mb-1 font-mono text-xs text-indigo-300">Part {i + 1} · lines {run.parts[i]?.startLine}-{run.parts[i]?.endLine}</div>}
                <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-slate-300">{r}</pre>
              </div>
            )) : (
              <div className="grid h-full min-h-[30vh] place-items-center text-center text-slate-500">
                <div><Code2 size={40} className="mx-auto mb-3 opacity-30" /><p>Review output appears here.</p></div>
              </div>
            )}
          </div>
          {history.length > 0 && (
            <details className="mt-3 border-t border-slate-800 pt-3 text-sm">
              <summary className="flex cursor-pointer items-center gap-2 text-slate-400"><History size={14} />Recent reviews ({history.length})</summary>
              <ul className="mt-2 space-y-1">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <button className="truncate text-left text-slate-300 hover:text-white" onClick={() => loadHistory(h)}>{h.desc || h.code.split('\n')[0].slice(0, 50) || 'Untitled'} <span className="text-xs text-slate-600">{new Date(h.at).toLocaleString()}</span></button>
                    <button onClick={() => removeHistory(h.id)} aria-label="Delete review" className="text-slate-600 hover:text-rose-400"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
