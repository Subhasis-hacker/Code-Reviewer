import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Terminal, Play, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

const DEFAULT_CODE = `def two_sum(nums, target):
    # Write your algorithmic solution here
    pass
`;

export default function CodeReviewer() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [problemDescription, setProblemDescription] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [events, setEvents] = useState([]);
  const [result, setResult] = useState(null);

  const handleReview = async () => {
    if (!code.trim()) return;
    setIsReviewing(true);
    setEvents([]);
    setResult(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Now passing the dynamic problem description to the backend payload
        body: JSON.stringify({ code, problem_description: problemDescription })
      });

      if (!response.ok) throw new Error('Stream failed to start');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";

        for (const block of lines) {
          const typeMatch = block.match(/event: (.*)/);
          const dataMatch = block.match(/data: (.*)/);

          if (typeMatch && dataMatch) {
            const eventType = typeMatch[1];
            const eventData = JSON.parse(dataMatch[1]);

            if (eventType === 'status') {
              setEvents(prev => [...prev, eventData]);
            } else if (eventType === 'result') {
              setResult(eventData);
              setCode(eventData.refactored_code || code);
              setIsReviewing(false);
            } else if (eventType === 'error') {
              setEvents(prev => [...prev, { label: 'Error occurred', status: 'error', error: eventData.message }]);
              setIsReviewing(false);
            }
          }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
      setIsReviewing(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
      {/* LEFT PANE: Context & Editor */}
      <div className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-zinc-900/80 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-zinc-300">workspace.py</span>
          </div>
          <button 
            onClick={handleReview}
            disabled={isReviewing}
            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-lg text-sm flex items-center gap-2 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isReviewing ? 'Analyzing...' : 'Run Review'}
          </button>
        </div>

        {/* NEW: Problem Description Area */}
        <div className="border-b border-zinc-800 p-4 bg-zinc-900/30 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <label className="text-xs font-medium text-zinc-400">Problem Context (Optional)</label>
          </div>
          <textarea
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            disabled={isReviewing}
            placeholder="Paste problem statement, constraints, or specific requirements here to guide the LangGraph AI..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 transition-colors resize-y min-h-[80px] max-h-[250px] placeholder:text-zinc-600 disabled:opacity-50"
          />
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 pt-4">
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }}
          />
        </div>
      </div>

      {/* RIGHT PANE: AI Telemetry Timeline */}
      <div className="w-full lg:w-[400px] bg-zinc-900/40 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
        <div className="bg-zinc-900/80 border-b border-zinc-800 px-4 py-3">
          <span className="text-sm font-medium text-zinc-300">LangGraph Execution Agent</span>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {events.length === 0 && !result && (
            <div className="text-center text-zinc-500 mt-10 text-sm">
              Waiting for code submission...
            </div>
          )}

          {events.map((ev, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="mt-1 relative">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  ev.status === 'error' ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'
                )} />
                {idx !== events.length - 1 && <div className="absolute top-3 left-1 w-[1px] h-full bg-zinc-800" />}
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium text-zinc-200">{ev.label}</p>
                {ev.time_complexity && (
                  <p className="text-xs text-zinc-400 mt-1">Time: {ev.time_complexity} | Space: {ev.space_complexity}</p>
                )}
                {ev.test_count > 0 && (
                  <p className="text-xs text-amber-400 mt-1">Generated {ev.test_count} edge-case tests</p>
                )}
              </div>
            </div>
          ))}

          {result && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                <CheckCircle2 className="w-5 h-5" /> Refactoring Complete
              </div>
              <p className="text-sm text-zinc-300">Pass Rate: {(result.pass_rate * 100).toFixed(0)}%</p>
              <p className="text-sm text-zinc-300">Time Complexity: {result.time_complexity}</p>
              <p className="text-sm text-zinc-300 mt-2 text-zinc-400">Code updated in editor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}