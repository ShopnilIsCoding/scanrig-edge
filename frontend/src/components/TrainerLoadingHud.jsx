import { motion, AnimatePresence } from 'motion/react';
import { useProgress } from '@react-three/drei';

export default function TrainerLoadingHud({ compact = false, label = 'INITIALIZING TRAINER' }) {
  const { active, progress, item } = useProgress();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className={`pointer-events-none absolute inset-0 z-[7] grid place-items-center ${compact ? 'p-2' : 'p-5'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className={`relative overflow-hidden rounded-[22px] border border-[#4de8d1]/20 bg-[#061014]/80 text-center shadow-[0_22px_70px_rgba(0,0,0,.35)] backdrop-blur-xl ${compact ? 'w-[190px] px-4 py-3' : 'w-[min(320px,80%)] px-6 py-5'}`}>
            <motion.div
              className="mx-auto mb-3 h-10 w-10 rounded-full border border-[#4de8d1]/35 border-t-[#b4ff3d]"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            />
            <div className="font-mono text-[9px] font-bold tracking-[.18em] text-[#4de8d1]">{label}</div>
            <div className="mt-2 font-mono text-[8px] tracking-[.1em] text-white/35">
              {item ? 'Loading trainer geometry' : 'Preparing trainer link'}
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
              <motion.div className="h-full bg-gradient-to-r from-[#4de8d1] to-[#b4ff3d]" animate={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <div className="mt-2 font-mono text-[8px] text-[#b4ff3d]">{Math.round(progress)}%</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
