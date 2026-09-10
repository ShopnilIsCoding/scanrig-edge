import { Component } from 'react';
import { motion } from 'motion/react';

function CssHologramFallback({ retrying = false }) {
  return (
    <div className="absolute inset-0 z-[8] grid place-items-center bg-[#071014]/94 p-6 text-center backdrop-blur-sm">
      <div className="max-w-[340px]">
        <div className="relative mx-auto h-44 w-44">
          <motion.div
            className="absolute inset-0 rounded-full border border-[#4de8d1]/30 shadow-[0_0_45px_rgba(77,232,209,.10)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-28 w-20 -translate-x-1/2 -translate-y-1/2 rounded-[40px] border border-[#4de8d1]/25"
            animate={{ opacity: [0.28, 0.55, 0.28], scale: [0.98, 1.03, 0.98] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-[26%] h-10 w-10 -translate-x-1/2 rounded-full border border-[#4de8d1]/25"
            animate={{ opacity: [0.2, 0.46, 0.2] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <motion.div
            className="absolute left-1/2 top-[38%] h-[2px] w-28 -translate-x-1/2 bg-[#4de8d1]/50"
            animate={{ y: [10, 92, 10], opacity: [0.2, 0.55, 0.2] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="mt-5 font-mono text-[10px] font-bold tracking-[.18em] text-[#4de8d1]">
          {retrying ? 'COACH RESETTING' : 'COACH TAKING A BREAK'}
        </div>
        <div className="mt-2 text-xs leading-6 text-white/45">
          {retrying
            ? 'Your coach paused for a moment. We are getting the session view ready again.'
            : 'Your coach could not restart right now. You can keep using the rest of ScanRig and try again later.'}
        </div>
      </div>
    </div>
  );
}

export default class TrainerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
    this.retryTimer = null;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[ScanRig] 3D view error boundary caught:', error);
    if (this.state.retryCount < 2) {
      this.retryTimer = window.setTimeout(() => {
        this.setState((state) => ({ hasError: false, retryCount: state.retryCount + 1 }));
      }, 900 + this.state.retryCount * 500);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey) {
      if (this.retryTimer) window.clearTimeout(this.retryTimer);
      if (this.state.hasError || this.state.retryCount) {
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({ hasError: false, retryCount: 0 });
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <CssHologramFallback retrying={this.state.retryCount < 2} />;
  }
}
