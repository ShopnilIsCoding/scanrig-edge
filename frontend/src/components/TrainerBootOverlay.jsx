import { motion, AnimatePresence } from 'motion/react';

export default function TrainerBootOverlay({
  show = true,
  progress = 0,
  runtimeReady = false,
  compact = false,
  label = 'WARMING UP YOUR COACH',
  error = false,
}) {
  const value = error ? 100 : Math.max(2, Math.min(100, Math.round(progress || 0)));
  const phase = error
    ? 'Your coach needs another warm-up'
    : progress < 100
      ? 'Getting your coach ready for the session'
      : runtimeReady
        ? 'Coach ready'
        : 'Finishing the warm-up';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`absolute inset-0 z-[40] grid place-items-center bg-[#061014]/[.97] backdrop-blur-md ${compact ? 'p-2' : 'p-5'}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className={`relative overflow-hidden rounded-[24px] border border-[#4de8d1]/20 bg-[#071116]/95 text-center shadow-[0_28px_90px_rgba(0,0,0,.48)] ${compact ? 'w-[205px] px-4 py-4' : 'w-[min(390px,86%)] px-7 py-7'}`}>
            <div className={`relative mx-auto ${compact ? 'h-20 w-20' : 'h-28 w-28'}`}>
              <motion.div
                className="absolute inset-0 rounded-full border border-[#4de8d1]/30 border-t-[#b4ff3d]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-[17%] rounded-full border border-[#ff8a3d]/25"
                animate={{ rotate: -360, scale: [0.96, 1.04, 0.96] }}
                transition={{ rotate: { duration: 2.4, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.5, repeat: Infinity } }}
              />
              <motion.div
                className="absolute left-1/2 top-[28%] h-[20%] w-[20%] -translate-x-1/2 rounded-full border border-[#4de8d1]/35 bg-[#4de8d1]/5"
                animate={{ opacity: [0.2, 0.75, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <motion.div
                className="absolute left-1/2 top-[51%] h-[29%] w-[28%] -translate-x-1/2 rounded-[45%] border border-[#4de8d1]/30 bg-[#4de8d1]/5"
                animate={{ opacity: [0.18, 0.6, 0.18] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <motion.div
                className="absolute left-[20%] right-[20%] top-[36%] h-px bg-[#4de8d1]/60"
                animate={{ y: [0, compact ? 34 : 54, 0], opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 1.65, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <div className={`${compact ? 'mt-3 text-[8px]' : 'mt-5 text-[10px]'} font-mono font-bold tracking-[.2em] ${error ? 'text-[#ff8a3d]' : 'text-[#4de8d1]'}`}>{error ? 'COACH WARM-UP PAUSED' : label}</div>
            <div className={`${compact ? 'mt-1 text-[8px]' : 'mt-2 text-xs'} text-white/45`}>{phase}</div>

            {!error && (
              <>
                <div className={`${compact ? 'mt-3 h-1' : 'mt-5 h-1.5'} overflow-hidden rounded-full bg-white/8`}>
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#4de8d1] via-[#b4ff3d] to-[#ff8a3d]"
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
                <div className={`${compact ? 'mt-2 text-[7px]' : 'mt-3 text-[8px]'} flex items-center justify-between font-mono tracking-[.12em] text-white/35`}>
                  <span>{progress < 100 ? 'WARM-UP' : 'FINAL STRETCH'}</span>
                  <span className="text-[#b4ff3d]">{progress < 100 ? `${value}%` : runtimeReady ? 'READY' : 'ALMOST READY'}</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
