import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { reviewApi } from '../api';

// ---- Token budget: ~4 chars per token. Each request carries at most CHUNK_CHARS of code,
// so a long file is reviewed as several small requests instead of one that exceeds the limit.
export const CHUNK_CHARS = 12000;   // ~3k tokens per request
const MIN_CHARS = 1500;             // never split below this when auto-shrinking
export const MAX_INPUT_CHARS = 200000;
export const estTokens = (s) => Math.ceil((s || '').length / 4);

export function splitCode(code, maxChars, base = 1) {
  const lines = code.split('\n'), parts = [];
  const mk = (a, b) => ({ text: lines.slice(a, b).join('\n'), startLine: base + a, endLine: base + b - 1 });
  let start = 0, size = 0, brk = -1;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].length + 1;
    if (size + len > maxChars && i > start) {
      const cut = brk > start ? brk : i;
      parts.push(mk(start, cut));
      start = cut; brk = -1;
      size = lines.slice(cut, i).reduce((n, l) => n + l.length + 1, 0);
    }
    const boundary = /^(async def |def |class |function |export |public |static )/.test(lines[i]) || (lines[i].trim() === '' && i + 1 < lines.length);
    if (size >= maxChars * 0.5 && boundary && i > start) brk = i;
    size += len;
  }
  if (start < lines.length) parts.push(mk(start, lines.length));
  return parts;
}

const tokenLimitError = (e) => e.status === 413 || ([400, 422, 500].includes(e.status) && /token|context|too long|too large|max.*length|exceed/i.test(e.message));
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
});

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

const Ctx = createContext(null);
export const useReview = () => useContext(Ctx);

export function ReviewProvider({ children }) {
  const [draft, setDraft] = useState(() => read('review:draft', { code: '', desc: '' }));
  const [run, setRun] = useState(null); // { parts, results, idx, status, error, note }
  const [history, setHistory] = useState(() => read('review:history', []));
  const abortRef = useRef(null);
  const runRef = useRef(null);

  useEffect(() => { write('review:draft', draft); }, [draft]);
  useEffect(() => { write('review:history', history); }, [history]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (p) => { runRef.current = { ...runRef.current, ...p }; setRun(runRef.current); };

  const execute = useCallback(async (parts, from, out, desc) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    runRef.current = { parts, results: out, idx: from, status: 'running', error: '', note: '' };
    setRun(runRef.current);
    try {
      for (let i = from; i < parts.length; i++) {
        let attempt = 0;
        for (;;) {
          const note = parts.length > 1 ? `\n\n[Part ${i + 1} of ${parts.length}: lines ${parts[i].startLine}-${parts[i].endLine} of a larger file. Review only this part; skip file-wide advice.]` : '';
          try {
            patch({ idx: i, note: '' });
            await reviewApi.stream({
              code: parts[i].text, problemDescription: desc + note, signal: ctrl.signal,
              onChunk: (t) => { out[i] = t; patch({ results: [...out], parts: [...parts] }); },
            });
            break;
          } catch (e) {
            if (e.name === 'AbortError') throw e;
            if (tokenLimitError(e) && parts[i].text.length > MIN_CHARS) {            // shrink and retry
              const halves = splitCode(parts[i].text, Math.ceil(parts[i].text.length / 2), parts[i].startLine);
              if (halves.length > 1) { parts.splice(i, 1, ...halves); out.length = Math.min(out.length, i); patch({ parts: [...parts], results: [...out], note: 'Request was too large; splitting the part further…' }); continue; }
            }
            if (e.status === 429 && attempt < 3) {                                    // rate / token-per-minute limit
              attempt++;
              const wait = (e.retryAfter || 5 * attempt) * 1000;
              patch({ note: `Rate limited. Retrying in ${Math.ceil(wait / 1000)}s…` });
              await sleep(wait, ctrl.signal);
              continue;
            }
            throw e;
          }
        }
      }
      patch({ status: 'done', note: '' });
      const text = out.map((r, i) => (parts.length > 1 ? `── Part ${i + 1} · lines ${parts[i].startLine}-${parts[i].endLine} ──\n` : '') + (r || '')).join('\n\n');
      setHistory((h) => [{ id: Date.now(), at: new Date().toISOString(), desc, code: parts.map((p) => p.text).join('\n').slice(0, 20000), text: text.slice(0, 60000) }, ...h].slice(0, 8));
    } catch (e) {
      if (e.name === 'AbortError') patch({ status: 'stopped', note: '' });
      else patch({ status: 'error', error: e.message || 'Review failed.', note: '' });
    }
  }, []);

  const start = useCallback(() => {
    const code = draft.code.slice(0, MAX_INPUT_CHARS);
    if (!code.trim()) return;
    execute(splitCode(code, CHUNK_CHARS), 0, [], draft.desc.trim());
  }, [draft, execute]);

  const resume = useCallback(() => {
    const r = runRef.current; if (!r) return;
    execute(r.parts, r.idx, r.results.slice(0, r.idx), draft.desc.trim());
  }, [draft.desc, execute]);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => { abortRef.current?.abort(); runRef.current = null; setRun(null); setDraft({ code: '', desc: '' }); }, []);
  const loadHistory = useCallback((h) => { abortRef.current?.abort(); setDraft({ code: h.code, desc: h.desc }); runRef.current = { parts: [{ text: '', startLine: 1, endLine: 1 }], results: [h.text], idx: 0, status: 'done', error: '', note: '' }; setRun(runRef.current); }, []);
  const removeHistory = useCallback((id) => setHistory((h) => h.filter((x) => x.id !== id)), []);

  return (
    <Ctx.Provider value={{ draft, setDraft, run, running: run?.status === 'running', history, start, stop, resume, reset, loadHistory, removeHistory }}>
      {children}
    </Ctx.Provider>
  );
}
