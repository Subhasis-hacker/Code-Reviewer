import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Code2, BarChart2, LogOut, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { path: '/app/reviewer', label: 'AI Reviewer', icon: Code2 },
    { path: '/app/cp-dashboard', label: 'CP Analytics', icon: BarChart2 },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/30 flex flex-col backdrop-blur-xl z-10">
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <Cpu className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="font-bold text-xl tracking-tight">AlgoReviewer</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <Link key={item.path} to={item.path}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border",
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 border-transparent"
                )}>
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 relative overflow-hidden bg-zinc-950">
        <AnimatePresence mode="wait">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="h-full overflow-y-auto"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}