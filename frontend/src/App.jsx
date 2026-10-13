// cp dashboard app.jsx (+ Code Reviewer route)

import { Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Map, Code2, LogOut, Terminal } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { ReviewProvider, useReview } from './context/ReviewContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import CPDashboard from './pages/CPDashboard';
import Roadmap from './pages/Roadmap';
import CodeReviewer from './pages/CodeReviewer';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;
  return user ? <ReviewProvider><Shell /></ReviewProvider> : <Navigate to="/login" replace />;
}

function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { running } = useReview();
  const link = ({ isActive }) =>
    `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${isActive ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:text-white'}`;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-bold text-white"><Terminal size={18} className="text-indigo-400" />CP Dashboard</span>
            <nav className="flex gap-1 overflow-x-auto">
              <NavLink to="/dashboard" className={link}><LayoutDashboard size={15} />Dashboard</NavLink>
              <NavLink to="/roadmap" className={link}><Map size={15} />Roadmap</NavLink>
              <NavLink to="/review" className={link}><Code2 size={15} />Code Reviewer{running && <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" title="Review running" />}</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user?.name || user?.email}</span>
            <button onClick={() => { logout(); nav('/'); }} className="btn-ghost !px-3 !py-1.5" aria-label="Log out"><LogOut size={15} />Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8"><Outlet /></main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b' } }} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Protected />}>
          <Route path="/dashboard" element={<CPDashboard />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/review" element={<CodeReviewer />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
