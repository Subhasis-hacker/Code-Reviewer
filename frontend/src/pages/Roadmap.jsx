import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, useNodesState, useEdgesState } from '@xyflow/react';
import toast from 'react-hot-toast';
import { Lock, Loader, Check } from 'lucide-react';
import { cpApi, errMsg } from '../api';

// Template structure: [id, label, parentId|null]. Status comes only from the API.
const TEMPLATES = {
  dsa: { name: 'DSA Fundamentals', items: [
    ['dsa-complexity', 'Complexity & Math', null], ['dsa-arrays', 'Arrays & Strings', 'dsa-complexity'],
    ['dsa-sorting', 'Sorting & Searching', 'dsa-arrays'], ['dsa-linked', 'Linked Lists', 'dsa-arrays'],
    ['dsa-stack', 'Stacks & Queues', 'dsa-linked'], ['dsa-recursion', 'Recursion & Backtracking', 'dsa-sorting'],
    ['dsa-trees', 'Trees & BST', 'dsa-stack'], ['dsa-heap', 'Heaps & Hashing', 'dsa-stack'],
    ['dsa-graphs', 'Graphs', 'dsa-trees'], ['dsa-dp', 'Dynamic Programming', 'dsa-recursion'] ] },
  cp: { name: 'Competitive Programming Prep', items: [
    ['cp-impl', 'Implementation', null], ['cp-greedy', 'Greedy', 'cp-impl'], ['cp-bs', 'Binary Search on Answer', 'cp-impl'],
    ['cp-number', 'Number Theory', 'cp-greedy'], ['cp-comb', 'Combinatorics', 'cp-number'],
    ['cp-dp', 'DP & Bitmask DP', 'cp-bs'], ['cp-graph', 'Graph Algorithms', 'cp-bs'],
    ['cp-ds', 'Segment Tree & DSU', 'cp-graph'], ['cp-str', 'String Algorithms', 'cp-dp'],
    ['cp-adv', 'Flows & Advanced Topics', 'cp-ds'] ] },
};

const STATUS = {
  planned: { label: 'Locked', icon: Lock, cls: 'border-slate-700 bg-slate-900 text-slate-500', next: 'in-progress' },
  'in-progress': { label: 'In progress', icon: Loader, cls: 'border-indigo-500 bg-indigo-500/10 text-indigo-200 shadow-[0_0_18px_rgba(99,102,241,.35)]', next: 'completed' },
  completed: { label: 'Mastered', icon: Check, cls: 'border-emerald-500 bg-emerald-500/10 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,.3)]', next: 'planned' },
};

function TopicNode({ data }) {
  const s = STATUS[data.status] || STATUS.planned; const Icon = s.icon;
  return (
    <div className={`w-48 cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition hover:scale-105 ${s.cls}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-600" />
      <div className="font-medium">{data.label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs opacity-80"><Icon size={12} />{s.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600" />
    </div>
  );
}
const nodeTypes = { topic: TopicNode };

function layout(items, statusById) {
  const depth = {}, seen = {};
  items.forEach(([id, , p]) => { depth[id] = p ? depth[p] + 1 : 0; });
  const nodes = items.map(([id, label]) => {
    const d = depth[id]; const idx = (seen[d] = (seen[d] ?? -1) + 1);
    const count = items.filter(([i]) => depth[i] === d).length;
    return { id, type: 'topic', position: { x: (idx - (count - 1) / 2) * 240, y: d * 120 }, data: { label, status: statusById[id] || 'planned' } };
  });
  const edges = items.filter(([, , p]) => p).map(([id, , p]) => ({ id: `${p}-${id}`, source: p, target: id, animated: statusById[id] === 'in-progress', style: { stroke: '#475569' } }));
  return { nodes, edges };
}

export default function Roadmap() {
  const [tpl, setTpl] = useState('dsa');
  const [statusById, setStatusById] = useState({});
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    cpApi.roadmap().then(({ data }) => {
      const list = Array.isArray(data) ? data : data?.nodes || [];
      setStatusById(Object.fromEntries(list.map((n) => [n.id || n.nodeId || n.node_id, n.status || n.data?.status])));
    }).catch((e) => { if (e.response?.status !== 404) toast.error(errMsg(e, 'Could not load roadmap progress.')); })
      .finally(() => setLoading(false));
  }, []);

  const laid = useMemo(() => layout(TEMPLATES[tpl].items, statusById), [tpl, statusById]);
  useEffect(() => { setNodes(laid.nodes); setEdges(laid.edges); }, [laid, setNodes, setEdges]);

  const onNodeClick = useCallback(async (_, node) => {
    const prev = node.data.status || 'planned';
    const next = STATUS[prev].next;
    setStatusById((m) => ({ ...m, [node.id]: next }));
    try { await cpApi.setNodeStatus(node.id, next); toast.success(`${node.data.label}: ${STATUS[next].label}`); }
    catch (e) { setStatusById((m) => ({ ...m, [node.id]: prev })); toast.error(errMsg(e, 'Could not update status.')); }
  }, []);

  const done = nodes.filter((n) => n.data.status === 'completed').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white">Roadmap</h1><p className="text-sm text-slate-500">Click a topic to move it from Locked to In progress to Mastered.</p></div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-slate-400">{done}/{nodes.length} mastered</span>
          <div className="flex rounded-lg border border-slate-800 p-1">
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button key={k} onClick={() => setTpl(k)} className={`rounded-md px-3 py-1.5 text-sm transition ${tpl === k ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>{t.name}</button>
            ))}
          </div>
        </div>
      </div>
      <div className={`h-[70vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 ${loading ? 'animate-pulse' : ''}`}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} nodesDraggable={false} nodesConnectable={false} fitView fitViewOptions={{ padding: 0.2 }} colorMode="dark" proOptions={{ hideAttribution: true }}>
          <Background color="#1e293b" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
