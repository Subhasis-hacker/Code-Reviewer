import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu, ArrowRight, Loader2 } from 'lucide-react';
import { authAPI } from '../../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await authAPI.login({ email, password });
      localStorage.setItem('token', res.data.access_token);
      navigate('/app/reviewer');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative z-10">
        <div className="p-8 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-3xl shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <Cpu className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-zinc-100 mb-2">System Terminal</h2>
          <p className="text-zinc-400 text-center mb-8">Authenticate to access the dashboard.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email address</label>
              <input 
                type="email" required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-colors"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
              <input 
                type="password" required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-colors"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="w-full mt-4 bg-zinc-100 text-zinc-900 hover:bg-emerald-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Initialize <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-zinc-400 text-sm">
            No access? <Link to="/register" className="text-emerald-400 hover:text-emerald-300">Create an account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}