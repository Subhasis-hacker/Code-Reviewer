import { Link } from 'react-router-dom';
import { motion, useMotionValue, useMotionTemplate, useSpring, useTransform } from 'framer-motion';
import { BarChart3, Target, GitBranch, Terminal } from 'lucide-react';

const headline = 'Know exactly what to solve next.'.split(' ');
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } };
const word = { hidden: { opacity: 0, y: 28, filter: 'blur(8px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } } };

const features = [
  { icon: BarChart3, title: 'Visual Analytics', color: 'text-cf', body: 'Topic mastery, rating trajectories and a submission heatmap across Codeforces, LeetCode and CodeChef in one view.' },
  { icon: Target, title: 'Smart Practice Recommendations', color: 'text-lc', body: 'Problems picked from your weak topics, so each session targets the gaps that cost you rating.' },
  { icon: GitBranch, title: 'Interactive Roadmap', color: 'text-cc', body: 'Follow a node-based path through DSA fundamentals or contest prep and mark topics as you master them.' },
];

function TiltCard({ icon: Icon, title, body, color }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [9, -9]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-9, 9]), { stiffness: 200, damping: 20 });
  const move = (e) => { const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left) / r.width - 0.5); y.set((e.clientY - r.top) / r.height - 0.5); };
  const reset = () => { x.set(0); y.set(0); };
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }} style={{ perspective: 900 }}>
      <motion.div onMouseMove={move} onMouseLeave={reset} style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }} className="panel h-full bg-slate-900/70 backdrop-blur">
        <Icon className={color} size={28} style={{ transform: 'translateZ(40px)' }} />
        <h3 className="mt-4 text-lg font-bold text-white" style={{ transform: 'translateZ(30px)' }}>{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400" style={{ transform: 'translateZ(20px)' }}>{body}</p>
      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const mx = useMotionValue(-1000), my = useMotionValue(-1000);
  const glow = useMotionTemplate`radial-gradient(520px circle at ${mx}px ${my}px, rgba(99,102,241,0.22), rgba(34,211,238,0.06) 45%, transparent 70%)`;
  return (
    <div className="relative min-h-screen overflow-hidden" onMouseMove={(e) => { mx.set(e.clientX); my.set(e.clientY); }}>
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: glow }} />
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 font-bold text-white"><Terminal size={18} className="text-indigo-400" />CP Dashboard</span>
        <div className="flex gap-2"><Link to="/login" className="btn-ghost">Log in</Link><Link to="/register" className="btn">Get started</Link></div>
      </nav>
      <section className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-24 text-center sm:pt-32">
        <motion.h1 variants={stagger} initial="hidden" animate="show" className="text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl">
          {headline.map((w, i) => <motion.span key={i} variants={word} className="mr-[0.25em] inline-block">{w}</motion.span>)}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }} className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
          Connect your Codeforces, LeetCode and CodeChef handles. See your strengths, fix your weak topics, and follow a roadmap.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="btn">Create your dashboard</Link>
          <Link to="/login" className="btn-ghost">I have an account</Link>
        </motion.div>
        <div className="mt-8 flex justify-center gap-4 font-mono text-xs"><span className="text-cf">Codeforces</span><span className="text-lc">LeetCode</span><span className="text-cc">CodeChef</span></div>
      </section>
      <section className="relative z-10 mx-auto grid max-w-6xl gap-5 px-4 pb-32 md:grid-cols-3">
        {features.map((f) => <TiltCard key={f.title} {...f} />)}
      </section>
    </div>
  );
}
