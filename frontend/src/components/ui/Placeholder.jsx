import { motion } from 'framer-motion';
import { Construction, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Temporary empty-state used for modules that arrive in a later phase.
 * Fully replaced by the real implementation in its dedicated phase.
 */
function Placeholder({ title, description, icon: Icon = Construction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full min-h-[60vh] items-center justify-center"
    >
      <div className="glass neon-hover w-full max-w-lg p-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-glow">
          <Icon className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-zinc-100">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">{description}</p>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-zinc-700/60',
            'bg-zinc-900/60 px-4 py-1.5 text-xs font-medium text-zinc-400',
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          Scheduled for a later build phase
        </span>
      </div>
    </motion.div>
  );
}

export default Placeholder;