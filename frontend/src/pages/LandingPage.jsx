import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BrainCircuit, Camera, CheckCircle2, Dumbbell, Gamepad2, LockKeyhole, ScanLine, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import TrainerShowcase3D from '../components/TrainerShowcase3D';
import { preloadTrainerAssetBundle } from '../components/AnimatedMixamoTrainer';
import ExerciseCard from '../components/ExerciseCard';
import { exercises } from '../data/exercises';

const features = [
  { icon: ScanLine, title: 'Live movement tracking', text: 'Follows your movement from the camera and helps count supported exercises.' },
  { icon: Camera, title: 'Hands-free rep counting', text: 'Track repetitions and sets while you focus on movement.' },
  { icon: BrainCircuit, title: 'A plan built around you', text: 'Build a plan from goals, level, equipment and available days.' },
  { icon: Trophy, title: 'Progress that feels rewarding', text: 'Earn XP, maintain streaks and unlock exercise achievements.' },
];

const sceneModes = {
  scan: { label: 'Coach idle', animation: 'defaultIdle', form: '33 pts', reps: 'READY', note: 'Landmarks locked' },
  reps: { label: 'Strength demo', animation: 'bicepCurl', form: '94%', reps: '12', note: 'Bicep cycle' },
  reward: { label: 'Reward', animation: 'victory', form: '+XP', reps: 'DONE', note: 'Goal cleared' },
};


function JourneyTrainerTrack() {
  const [direction, setDirection] = useState('right');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDirection((current) => (current === 'right' ? 'left' : 'right'));
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="journey-trainer-v2 journey-trainer-3d"
      animate={{ left: ['8%', '78%', '8%'] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'linear', times: [0, 0.5, 1] }}
    >
      <TrainerShowcase3D
        animation="walking"
        variant="journey"
        rotationY={direction === 'right' ? Math.PI / 2 : -Math.PI / 2}
      />
    </motion.div>
  );
}

export default function LandingPage() {
  const [sceneMode, setSceneMode] = useState('reps');
  const activeScene = sceneModes[sceneMode];

  useEffect(() => {
    preloadTrainerAssetBundle();
  }, []);

  return (
    <div className="landing-page landing-v2">
      <section className="hero section-shell">
        <div className="hero-copy">
          <motion.div className="hero-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span><Sparkles size={15} /></span> Your camera becomes a home trainer
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            Move. Get counted.<br /><em>Train with vision.</em>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            ScanRig turns home workouts into guided sessions with automatic rep counting, form tips and a weekly plan built around you.
          </motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <Link className="button button-large" to="/onboarding">Enter the profile lab <ArrowRight size={18} /></Link>
            <Link className="button button-large button-secondary" to="/workout"><Camera size={18} /> Open camera trainer</Link>
          </motion.div>
          <div className="trust-row">
            <span><LockKeyhole size={16} /> Video stays in the browser</span>
            <span><CheckCircle2 size={16} /> Camera-driven rep tracking</span>
          </div>
        </div>

        <motion.div className="hero-scene hero-scene-v2" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}>
          <div className="scene-grid" />
          <div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" />
          <div className="scene-particles">{Array.from({ length: 12 }, (_, index) => <i style={{ '--i': index }} key={index} />)}</div>
          <div className="scene-label"><i /> YOUR DIGITAL TRAINER</div>

          <div className="hero-avatar-center hero-3d-center">
            <TrainerShowcase3D animation={activeScene.animation} variant="hero" />
          </div>

          <motion.div className="floating-metric metric-one" animate={{ y: [0, -7, 0] }} transition={{ duration: 2.8, repeat: Infinity }}>
            <small>FORM SCORE</small><strong>{activeScene.form}</strong><span>{activeScene.note}</span>
          </motion.div>
          <motion.div className="floating-metric metric-two" animate={{ y: [0, 7, 0] }} transition={{ duration: 3.2, repeat: Infinity }}>
            <small>COUNTER</small><strong>{activeScene.reps}</strong><span>{sceneMode === 'reps' ? 'Target: 15' : 'Camera stream'}</span>
          </motion.div>
          <motion.div className="floating-metric metric-three" animate={{ x: [0, -6, 0] }} transition={{ duration: 3.6, repeat: Infinity }}>
            <small>SESSION</small><strong>{sceneMode === 'reward' ? 'CLEARED' : 'ACTIVE'}</strong><span>{sceneMode === 'reward' ? '+120 XP earned' : 'Local processing'}</span>
          </motion.div>

          <div className="scanner-frame"><i /><i /><i /><i /></div>
          <div className="hero-floor-platform"><span>COACH POSITION LOCKED</span></div>
          <div className="scene-mode-controls">
            {Object.entries(sceneModes).map(([key, item]) => (
              <button type="button" className={sceneMode === key ? 'active' : ''} onClick={() => setSceneMode(key)} key={key}><i />{item.label}</button>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="signal-strip">
        <span>LIVE BODY TRACKING</span><i />
        <span>BODY-SKELETON OVERLAY</span><i />
        <span>REAL-TIME REP ENGINE</span><i />
        <span>PERSONALIZED PLANS</span>
      </section>

      <section className="section-shell content-section" id="features">
        <div className="section-heading">
          <div><span className="eyebrow">CORE EXPERIENCE</span><h2>A complete fitness loop, not a manual tracker.</h2></div>
          <p>The product guides the user from profile setup to a live workout, then stores progress and adapts the next plan.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }, index) => (
            <motion.article key={title} className="feature-card interactive-feature-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} whileHover={{ y: -8, rotateX: 2 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }}>
              <span><Icon /></span><small>0{index + 1}</small><h3>{title}</h3><p>{text}</p><i className="feature-scan-line" />
            </motion.article>
          ))}
        </div>
      </section>

      <section className="section-shell journey-section" id="how-it-works">
        <div className="journey-copy">
          <span className="eyebrow">GAME-LIKE ONBOARDING</span>
          <h2>Your fitness profile becomes a short animated journey.</h2>
          <p>Your virtual coach changes movement naturally while each stage adds a matching scan effect for age, height, weight, goals and schedule.</p>
          <ul className="check-list">
            <li><CheckCircle2 /> Real walking and running transitions</li>
            <li><CheckCircle2 /> Exercise demos from James and Jody</li>
            <li><CheckCircle2 /> Profile values feed the final plan</li>
          </ul>
          <Link className="button" to="/onboarding"><Gamepad2 size={18} /> Enter interactive lab</Link>
        </div>
        <div className="journey-map journey-map-v2">
          {['Birthday', 'Height', 'Weight', 'Goal', 'Schedule', 'Plan'].map((item, index) => (
            <motion.div className="journey-node" whileHover={{ scale: 1.08, y: -4 }} key={item}><span>{index + 1}</span><strong>{item}</strong></motion.div>
          ))}
          <JourneyTrainerTrack />
        </div>
      </section>

      <section className="section-shell content-section">
        <div className="section-heading">
          <div><span className="eyebrow">EXERCISE LIBRARY</span><h2>Learn the move before the camera counts it.</h2></div>
          <Link className="text-link" to="/exercises">Browse all exercises <ArrowRight size={16} /></Link>
        </div>
        <div className="exercise-grid landing-exercise-grid">
          {exercises.slice(0, 3).map((exercise) => <ExerciseCard exercise={exercise} key={exercise.id} />)}
        </div>
      </section>

      <section className="section-shell cta-panel">
        <div><Dumbbell size={32} /><span className="eyebrow">READY FOR YOUR FIRST SESSION?</span><h2>Build the profile. Open the camera. Start moving.</h2></div>
        <Link className="button button-large" to="/register">Create free account <ArrowRight size={18} /></Link>
      </section>
    </div>
  );
}
