import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  BatteryCharging,
  AudioLines,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  CirclePause,
  Gauge,
  Flame,
  Eye,
  EyeOff,
  Lightbulb,
  Mic2,
  Music,
  Maximize2,
  Play,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CameraStage from '../components/CameraStage';
import PoseReplay from '../components/PoseReplay';
import { exercises } from '../data/exercises';
import { useApp } from '../context/AppContext';
import { getAdaptiveTarget, getRecommendedExerciseIds } from '../utils/personalization';
import useExerciseClassifier from '../ai/useExerciseClassifier';
import { startFocusBeat, stopFocusBeat } from '../utils/focusBeat';
import { caloriesFromExerciseSeconds, estimatePlanCalories } from '../utils/calories';

const EXERCISE_CONFIG = {
  'push-up': { target: 10, sets: 3, unit: 'reps', mode: 'reps' },
  squat: { target: 12, sets: 3, unit: 'reps', mode: 'reps' },
  lunge: { target: 20, sets: 3, unit: 'alternating reps', mode: 'reps' },
  'jumping-jack': { target: 20, sets: 3, unit: 'reps', mode: 'reps' },
  'shoulder-press': { target: 10, sets: 3, unit: 'reps', mode: 'reps' },
  'biceps-curl': { target: 12, sets: 3, unit: 'reps', mode: 'reps' },
  'high-knees': { target: 20, sets: 3, unit: 'reps', mode: 'reps' },
  crunch: { target: 12, sets: 3, unit: 'reps', mode: 'reps' },
  plank: { target: 30, sets: 3, unit: 'sec', mode: 'hold' },
};


const COACH_TIPS = {
  'jumping-jack': {
    start: 'Start tall. Open your feet and raise both hands together, then return with soft knees.',
    halfway: 'Good rhythm. Keep the landings light and finish every arm cycle.',
  },
  'high-knees': {
    start: 'Stand tall. Drive one knee toward hip height, return it, then switch sides.',
    halfway: 'Stay upright and keep the knee drive sharp. Do not lean backward.',
  },
  'biceps-curl': {
    start: 'Keep your upper arms close to your body. Curl smoothly and lower the weight under control.',
    halfway: 'Nice work. Keep the elbows quiet and avoid swinging your torso.',
  },
  squat: {
    start: 'Feet around shoulder width. Sit your hips back, keep your chest tall, and stand through the whole foot.',
    halfway: 'Keep the knees tracking over the feet and make every rep the same depth.',
  },
  'shoulder-press': {
    start: 'Brace your core and press both hands overhead without leaning back.',
    halfway: 'Keep the wrists stacked above the elbows and lower with control.',
  },
  'push-up': {
    start: 'Set a straight line from shoulders through hips. Lower the chest under control and press back up.',
    halfway: 'Keep the core tight. Do not let the hips drop as you press.',
  },
  crunch: {
    start: 'Lie side-on to the camera with knees bent. Brace your core and lift only your shoulders.',
    halfway: 'Keep the movement small and controlled. Do not pull your neck.',
  },
  lunge: {
    start: 'Take a stable step, keep the front heel planted, and lower with your chest tall.',
    halfway: 'Control the return and keep your front knee tracking over your foot.',
  },
  plank: {
    start: 'Brace your abdomen and hold shoulders, hips, and legs in one strong line.',
    halfway: 'Keep breathing. Stay long through the spine and do not let the hips sag.',
  },
};

const EMPTY_TRACKING = {
  formScore: 0,
  feedback: 'Start the camera and move into frame',
  metric: 0,
  metricLabel: 'WAITING',
};


const FORM_FOCUS = {
  squat: 'Keep your chest tall, sit the hips back, and make the knee path repeatable.',
  'biceps-curl': 'Keep the elbow parked beside the ribs and remove torso swing from the curl.',
  'shoulder-press': 'Brace before every press and keep the wrists stacked over the elbows.',
  'jumping-jack': 'Finish the overhead arm path and land softly with a steady rhythm.',
  'high-knees': 'Stay tall and drive the knee instead of leaning backward to create height.',
  'push-up': 'Keep shoulders, hips and legs moving as one line while the elbows bend.',
  lunge: 'Keep the front foot planted and lower under control without collapsing the knee inward.',
  crunch: 'Keep the movement small, lead with the rib cage, and avoid pulling on the neck.',
  plank: 'Brace the abdomen and keep shoulders, hips and legs in one long line.',
};

function average(values = []) {
  const valid = values.filter((value) => Number.isFinite(Number(value)));
  return valid.length ? valid.reduce((sum, value) => sum + Number(value), 0) / valid.length : 0;
}

function buildFormReport(statsMap = {}, averageForm = 0, fatigueScore = 0, fatigueEvents = 0) {
  const breakdown = Object.entries(statsMap).map(([id, data]) => ({
    id,
    name: data.name || id,
    reps: Number(data.reps || 0),
    average: Math.round(average(data.scores || [])),
    best: Math.round(Math.max(0, ...(data.scores || []))),
    adjust: (data.scores || []).filter((score) => score < 80).length,
    topCue: Object.entries(data.cues || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || '',
  })).filter((item) => item.reps || item.average);
  const allScores = Object.values(statsMap).flatMap((data) => data.scores || []).filter(Number.isFinite);
  const mean = average(allScores) || averageForm;
  const variance = allScores.length ? average(allScores.map((value) => (value - mean) ** 2)) : 0;
  const consistency = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance) * 2.4)));
  const strongest = [...breakdown].sort((a,b)=>b.average-a.average)[0] || null;
  const focus = [...breakdown].sort((a,b)=>a.average-b.average)[0] || null;
  const strongReps = allScores.filter((score)=>score>=90).length;
  const goodReps = allScores.filter((score)=>score>=80&&score<90).length;
  const adjustReps = allScores.filter((score)=>score<80).length;
  const grade = averageForm >= 93 ? 'A+' : averageForm >= 88 ? 'A' : averageForm >= 82 ? 'B+' : averageForm >= 76 ? 'B' : 'C';
  const fatigueMessage = fatigueScore >= 65
    ? 'Your quality dropped late in the session. The next workout should protect technique with slightly longer recovery.'
    : fatigueScore >= 35
      ? 'A mild quality drop appeared as the session progressed. Keep the next sets controlled rather than chasing speed.'
      : 'Your movement quality stayed relatively stable through the session.';
  const focusTip = focus ? FORM_FOCUS[focus.id] || focus.topCue || 'Repeat the movement slowly and make each rep look the same.' : 'Keep building consistent, controlled repetitions.';
  const coachSummary = strongest && focus
    ? `${strongest.name} was your strongest movement today. ${focus.name} is the clearest technique opportunity. ${fatigueMessage}`
    : fatigueMessage;
  return { grade, consistency, strongReps, goodReps, adjustReps, strongest, focus, focusTip, fatigueMessage, fatigueEvents, coachSummary, exerciseBreakdown: breakdown };
}

function getExercise(id) {
  return exercises.find((item) => item.id === id) || exercises[0];
}

export default function WorkoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusedExercise = searchParams.get('exercise');
  const { completeWorkout, profile, currentUser, workoutHistory, customExercises, personalizedPlan, todayReadiness } = useApp();
  const customAI = useExerciseClassifier();
  const catalog = useMemo(() => [...exercises, ...(customExercises || [])], [customExercises]);
  const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  const planSession = personalizedPlan?.schedule?.find((item) => item.day === todayName) || personalizedPlan?.schedule?.[0];
  const queueIds = useMemo(() => {
    if (focusedExercise && catalog.some((item) => item.id === focusedExercise)) return [focusedExercise];
    const planIds = planSession?.exercises?.map((item) => item.id).filter((id) => catalog.some((item) => item.id === id));
    return planIds?.length ? planIds : getRecommendedExerciseIds(profile, workoutHistory);
  }, [focusedExercise, catalog, planSession, profile, workoutHistory]);
  const sessionExercises = useMemo(() => queueIds.map((id) => catalog.find((item) => item.id === id)).filter(Boolean), [queueIds, catalog]);

  const [phase, setPhase] = useState('setup'); // setup | countdown | active | rest | complete
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setNumber, setSetNumber] = useState(1);
  const [reps, setReps] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tracking, setTracking] = useState(EMPTY_TRACKING);
  const [countdown, setCountdown] = useState(3);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restTitle, setRestTitle] = useState('Rest');
  const [lightReady, setLightReady] = useState(false);
  const [spaceReady, setSpaceReady] = useState(false);
  const [cameraStartRequest, setCameraStartRequest] = useState(0);
  const [cameraState, setCameraState] = useState({ active: false, modelState: 'not loaded', bodyVisible: false, status: 'Camera is off' });
  const [bodyReady, setBodyReady] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem('scanrig:coach-voice') !== 'off');
  const [voiceStyle, setVoiceStyle] = useState(() => localStorage.getItem('scanrig:coach-style') || 'balanced');
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(false);
  const [voiceCommandStatus, setVoiceCommandStatus] = useState('Say “pause”, “resume”, “skip rest”, or “repeat cue”.');
  const [alignmentEnabled, setAlignmentEnabled] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [workoutFullscreen, setWorkoutFullscreen] = useState(false);
  const [formReport, setFormReport] = useState(null);
  const [replayChoice, setReplayChoice] = useState('review');
  const [lastRepQuality, setLastRepQuality] = useState(null);
  const [recentRepQuality, setRecentRepQuality] = useState([]);
  const [fatigueEvents, setFatigueEvents] = useState(0);
  const [peakFatigueScore, setPeakFatigueScore] = useState(0);
  const [sessionReps, setSessionReps] = useState(0);
  const [formSamples, setFormSamples] = useState([]);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [exerciseActiveSeconds, setExerciseActiveSeconds] = useState({});
  const [earned, setEarned] = useState(0);
  const [completedExercises, setCompletedExercises] = useState([]);
  const completionLock = useRef(false);
  const restNextRef = useRef(null);
  const lastSpokenAtRef = useRef(0);
  const lastSpokenCueRef = useRef('');
  const fatigueAlertedRef = useRef(false);
  const safetyAlertedRef = useRef(false);
  const voiceSpeakingRef = useRef(false);
  const ignoreRecognitionUntilRef = useRef(0);
  const recognitionRef = useRef(null);
  const voiceCommandsWantedRef = useRef(false);
  const poseRingRef = useRef([]);
  const bestClipRef = useRef({ score: -1, exerciseId: '', exerciseName: '', frames: [] });
  const reviewClipRef = useRef({ score: 101, exerciseId: '', exerciseName: '', frames: [] });
  const exerciseStatsRef = useRef({});
  const workoutRootRef = useRef(null);
  const bodyVisibleRef = useRef(false);
  const preflightSpokenRef = useRef(false);
  const workoutPhaseRef = useRef(phase);
  const trackingStateRef = useRef(tracking);
  const exerciseStateRef = useRef(null);

  const exercise = sessionExercises[exerciseIndex];
  const planDose = planSession?.exercises?.find((item) => item.id === exercise?.id);
  const baseConfig = useMemo(() => {
    if (!exercise) return { target: 10, sets: 1, unit: 'reps', mode: 'reps' };
    if (EXERCISE_CONFIG[exercise.id]) return EXERCISE_CONFIG[exercise.id];
    if (exercise.trackerTemplate === 'classifier-only') return { target: Number(exercise.baseTarget || 30), sets: Number(exercise.sets || 1), unit: 'practice sec', mode: 'ai-practice' };
    return { target: Number(exercise.baseTarget || 10), sets: Number(exercise.sets || 3), unit: exercise.trackingMode === 'hold' ? 'sec' : 'reps', mode: exercise.trackingMode === 'hold' ? 'hold' : 'reps' };
  }, [exercise]);
  const config = useMemo(() => {
    if (planDose) return { ...baseConfig, target: Number(planDose.target || baseConfig.target), sets: Number(planDose.sets || baseConfig.sets), unit: planDose.unit || baseConfig.unit };
    return { ...baseConfig, target: baseConfig.mode === 'hold' || baseConfig.mode === 'ai-practice' ? baseConfig.target : getAdaptiveTarget(baseConfig.target, profile, workoutHistory) };
  }, [baseConfig, planDose, profile, workoutHistory]);
  const progress = Math.min(100, (reps / config.target) * 100);
  const formScore = tracking.formScore || 0;
  const cameraResponsive = cameraState.active;
  const bodyVisible = cameraState.bodyVisible;
  const readiness = personalizedPlan?.readiness || todayReadiness || null;
  const coachName = profile?.gender === 'female' ? 'Jody' : 'James';
  const firstName = String(profile?.name || currentUser?.name || '').trim().split(/\s+/)[0] || 'athlete';
  const setupReady = cameraResponsive && lightReady && spaceReady;
  const liveCalories = Math.round(caloriesFromExerciseSeconds(exerciseActiveSeconds, catalog, profile));
  const plannedCalories = Number(planSession?.calorieTarget || estimatePlanCalories(planSession, catalog, profile) || 0);
  const sessionProgress = Math.round(((exerciseIndex + (phase === 'complete' ? 1 : 0)) / sessionExercises.length) * 100);
  const fatigue = useMemo(() => {
    const values = recentRepQuality.filter((value) => Number(value) > 0);
    if (values.length < 3) return { score: 0, band: 'stable', label: 'Building signal', drop: 0 };
    const first = values.slice(0, 2).reduce((sum, value) => sum + value, 0) / Math.min(2, values.length);
    const last = values.slice(-2).reduce((sum, value) => sum + value, 0) / Math.min(2, values.length);
    const drop = Math.max(0, first - last);
    const score = Math.max(0, Math.min(100, Math.round(Math.max(0, 82 - last) * 2.2 + drop * 3.2)));
    if (last < 72 || drop >= 15) return { score, band: 'high', label: 'Quality dropping', drop: Math.round(drop) };
    if (last < 82 || drop >= 8) return { score, band: 'watch', label: 'Watch fatigue', drop: Math.round(drop) };
    return { score, band: 'stable', label: 'Stable quality', drop: Math.round(drop) };
  }, [recentRepQuality]);
  const readinessRestBonus = Number(planSession?.restBonusSeconds ?? readiness?.adjustments?.restBonusSeconds ?? 0);
  const fatigueRestBonus = fatigue.band === 'high' ? 15 : fatigue.band === 'watch' ? 5 : 0;
  const adaptiveSetRest = Math.min(60, 20 + readinessRestBonus + fatigueRestBonus);
  const adaptiveExerciseRest = Math.min(75, 30 + readinessRestBonus + fatigueRestBonus);
  const safetyConcern = useMemo(() => {
    const lastThree = recentRepQuality.slice(-3).filter((value) => Number(value) > 0);
    if (lastThree.length < 2) return false;
    const lowCount = lastThree.filter((value) => value < 60).length;
    return lowCount >= 2 || average(lastThree) < 58;
  }, [recentRepQuality]);

  useEffect(() => { localStorage.setItem('scanrig:coach-voice', voiceEnabled ? 'on' : 'off'); }, [voiceEnabled]);
  useEffect(() => { localStorage.setItem('scanrig:coach-style', voiceStyle); }, [voiceStyle]);
  useEffect(() => {
    const sync = () => setWorkoutFullscreen(document.fullscreenElement === workoutRootRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  useEffect(() => {
    if (musicEnabled) startFocusBeat(); else stopFocusBeat();
    return () => stopFocusBeat();
  }, [musicEnabled]);

  useEffect(() => { workoutPhaseRef.current = phase; }, [phase]);
  useEffect(() => { trackingStateRef.current = tracking; }, [tracking]);
  useEffect(() => { exerciseStateRef.current = exercise; }, [exercise]);
  useEffect(() => {
    if (!cameraResponsive) setBodyReady(false);
    else if (bodyVisible) setBodyReady(true);
  }, [cameraResponsive, bodyVisible]);

  useEffect(() => {
    customAI.reset();
    poseRingRef.current = [];
  }, [exercise.id, customAI.reset]);

  useEffect(() => {
    setPeakFatigueScore((current) => Math.max(current, fatigue.score));
    if (phase === 'active' && fatigue.band === 'high' && !fatigueAlertedRef.current) {
      fatigueAlertedRef.current = true;
      setFatigueEvents((value) => value + 1);
      speakCoach('Your rep quality is dropping. Slow the next reps down; I will give you a longer recovery after this set.', 1800);
    }
    if (fatigue.band === 'stable') fatigueAlertedRef.current = false;
  }, [fatigue.score, fatigue.band, phase]);

  useEffect(() => {
    if (phase === 'active' && safetyConcern && !safetyAlertedRef.current) {
      safetyAlertedRef.current = true;
      speakCoach('Pause for a moment and reset your position. If the movement hurts or feels wrong, stop the exercise.', 0, { force: true });
    }
    if (!safetyConcern) safetyAlertedRef.current = false;
  }, [phase, safetyConcern]);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    setCountdown(3);
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setPhase('active');
          return 0;
        }
        return value - 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active' || paused) return undefined;
    const timer = window.setInterval(() => {
      setSessionSeconds((value) => value + 1);
      if (exercise?.id) setExerciseActiveSeconds((current) => ({ ...current, [exercise.id]: Number(current[exercise.id] || 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, paused, exercise?.id]);

  useEffect(() => {
    if (phase !== 'active' || paused || config.mode !== 'ai-practice') return undefined;
    const timer = window.setInterval(() => {
      if (!customAI.modelReady || customAI.prediction.label !== exercise.id || customAI.prediction.confidence < 0.72) return;
      setReps((current) => {
        const next = Math.min(config.target, current + 1);
        if (next >= config.target) window.setTimeout(() => completeSet(), 0);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, paused, config.mode, config.target, customAI.modelReady, customAI.prediction.label, customAI.prediction.confidence, exercise.id]);

  useEffect(() => {
    if (phase !== 'rest' || restSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRestSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          restNextRef.current?.();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, restSeconds]);

  const speakCoach = (message, minGap = 2600, options = {}) => {
    if (!voiceEnabled || !message || !('speechSynthesis' in window)) return false;
    const now = Date.now();
    if (!options.force && now - lastSpokenAtRef.current < minGap) return false;
    if (!options.force && lastSpokenCueRef.current === message && now - lastSpokenAtRef.current < minGap * 2) return false;
    if (options.interrupt !== false) window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices?.() || [];
    const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang || ''));
    const pattern = coachName === 'Jody'
      ? /(jenny|aria|samantha|zira|female|susan|victoria|karen)/i
      : /(guy|david|mark|daniel|male|alex|george)/i;
    const selectedVoice = english.find((voice) => pattern.test(voice.name)) || english[0] || voices[0];
    const utterance = new SpeechSynthesisUtterance(message);
    if (selectedVoice) utterance.voice = selectedVoice;
    const style = voiceStyle === 'energetic' ? { rate: 1.08, pitch: 1.04, volume: 1 } : voiceStyle === 'calm' ? { rate: .94, pitch: .98, volume: .88 } : { rate: 1.01, pitch: 1, volume: .94 };
    utterance.rate = options.rate || style.rate;
    utterance.pitch = options.pitch || style.pitch;
    utterance.volume = options.volume || style.volume;
    utterance.onstart = () => { voiceSpeakingRef.current = true; ignoreRecognitionUntilRef.current = Date.now() + 1200; };
    utterance.onend = () => { voiceSpeakingRef.current = false; ignoreRecognitionUntilRef.current = Date.now() + 1200; };
    utterance.onerror = () => { voiceSpeakingRef.current = false; ignoreRecognitionUntilRef.current = Date.now() + 500; };
    window.speechSynthesis.speak(utterance);
    lastSpokenAtRef.current = now;
    lastSpokenCueRef.current = message;
    return true;
  };

  useEffect(() => {
    if (!voiceEnabled || phase !== 'active' || paused || !tracking.feedback || !formScore) return;
    if (formScore < 76) speakCoach(tracking.feedback, 4200);
  }, [voiceEnabled, phase, paused, tracking.feedback, formScore]);


  useEffect(() => {
    if (phase !== 'setup' || !voiceEnabled) return;
    if (cameraResponsive && bodyReady && !preflightSpokenRef.current) {
      preflightSpokenRef.current = true;
      const readinessLine = readiness ? ` Your today score is ${readiness.score} out of 100, so I will adjust recovery as we go.` : '';
      speakCoach(`Camera locked, ${firstName}. I can see the working joints.${readinessLine}`, 0, { force: true });
    }
    if (!cameraResponsive) preflightSpokenRef.current = false;
  }, [phase, voiceEnabled, cameraResponsive, bodyReady, readiness, firstName]);

  useEffect(() => {
    bodyVisibleRef.current = bodyVisible;
    if (!voiceEnabled || !cameraResponsive || phase !== 'active') return undefined;
    if (bodyVisible) {
      if (cameraState.active && lastSpokenCueRef.current === '__pose_lost__') {
        lastSpokenCueRef.current = '';
        speakCoach(`Got you again, ${firstName}. Reset your position and continue when ready.`, 0, { force: true });
      }
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (!bodyVisibleRef.current && phase === 'active') {
        speakCoach(`${firstName}, I lost the working joints. Step back or adjust the camera until the skeleton locks again.`, 0, { force: true });
        lastSpokenCueRef.current = '__pose_lost__';
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [bodyVisible, cameraResponsive, cameraState.active, phase, voiceEnabled, firstName]);

  useEffect(() => {
    if (!voiceEnabled || phase !== 'rest') return;
    if (restSeconds === 10) speakCoach('Ten seconds. Slow your breathing and prepare your stance.', 0, { force: true, interrupt: false });
    if (restSeconds === 3) speakCoach('Three, two, one. Get ready.', 0, { force: true });
  }, [restSeconds, phase, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled || phase !== 'active' || paused) return;
    if (sessionSeconds === 1) speakCoach(`I am with you, ${firstName}. Smooth reps first; speed comes second.`, 0, { force: true });
  }, [sessionSeconds, phase, paused, voiceEnabled, firstName]);

  const recordFormSample = (score) => {
    if (!score) return;
    setFormSamples((current) => [...current.slice(-199), score]);
  };


  const handlePoseFrame = (frame) => {
    if (phase !== 'active' || paused || !frame?.landmarks?.length) return;
    poseRingRef.current = [...poseRingRef.current.slice(-69), frame];
  };

  const recordExerciseRep = (score, feedback = '') => {
    if (!exercise?.id || !score) return;
    const current = exerciseStatsRef.current[exercise.id] || { name: exercise.name, reps: 0, scores: [], cues: {} };
    current.reps += 1;
    current.scores = [...current.scores.slice(-79), score];
    if (feedback && score < 86) current.cues[feedback] = Number(current.cues[feedback] || 0) + 1;
    exerciseStatsRef.current[exercise.id] = current;
    const clip = poseRingRef.current.slice(-55);
    if (clip.length >= 8 && score > bestClipRef.current.score) bestClipRef.current = { score, exerciseId: exercise.id, exerciseName: exercise.name, frames: [...clip] };
    if (clip.length >= 8 && score < reviewClipRef.current.score) reviewClipRef.current = { score, exerciseId: exercise.id, exerciseName: exercise.name, frames: [...clip] };
  };

  const startCountdown = () => {
    if (!setupReady) return;
    setPaused(false);
    speakCoach(`${firstName}, we are starting ${exercise.name}, set ${setNumber}. ${COACH_TIPS[exercise.id]?.start || 'Move with control and follow the live form cue.'}`, 0, { force: true });
    setPhase('countdown');
  };

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    speakCoach(next ? 'Paused. Reset your breathing and stance.' : 'Resuming. Find your opening position and continue.', 0, { force: true });
  };

  const requestCamera = () => {
    setCameraStartRequest((value) => value + 1);
  };

  const toggleWorkoutFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else await workoutRootRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen can be blocked by browser policy; the workout remains usable.
    }
  };

  const resetCurrentSet = () => {
    setReps(0);
    setTracking({ ...EMPTY_TRACKING, feedback: 'Move into the opening position', metricLabel: 'CALIBRATING' });
  };

  const startRest = ({ seconds, title, next }) => {
    restNextRef.current = next;
    setRestSeconds(seconds);
    setRestTitle(title);
    setPaused(true);
    setPhase('rest');
    const stats = exerciseStatsRef.current[exercise?.id];
    const recent = stats?.scores?.slice(-Math.max(1, config.target)) || [];
    const quality = recent.length ? Math.round(average(recent)) : 0;
    const qualityLine = quality ? ` That effort averaged ${quality} percent form.` : '';
    const fatigueLine = fatigue.band === 'high' ? ' I am extending recovery because your recent rep quality dropped.' : ' Relax your shoulders and reset your breathing.';
    speakCoach(`${title}.${qualityLine}${fatigueLine}`, 0, { force: true });
  };

  const moveToNextSet = () => {
    fatigueAlertedRef.current = false;
    setRecentRepQuality([]);
    setSetNumber((value) => value + 1);
    resetCurrentSet();
    setPaused(false);
    setPhase('active');
  };

  const moveToNextExercise = () => {
    fatigueAlertedRef.current = false;
    setRecentRepQuality([]);
    const nextExercise = sessionExercises[exerciseIndex + 1];
    if (nextExercise) speakCoach(`${firstName}, next is ${nextExercise.name}. ${COACH_TIPS[nextExercise.id]?.start || 'Reset your stance and move with control.'}`, 0, { force: true });
    setExerciseIndex((value) => value + 1);
    setSetNumber(1);
    resetCurrentSet();
    setPaused(false);
    setPhase('countdown');
  };

  const finishSession = () => {
    if (completionLock.current) return;
    completionLock.current = true;
  const averageForm = formSamples.length
      ? Math.round(formSamples.reduce((sum, score) => sum + score, 0) / formSamples.length)
      : Math.max(70, formScore || 80);
    const report = buildFormReport(exerciseStatsRef.current, averageForm, peakFatigueScore, fatigueEvents);
    setFormReport(report);
    if (!reviewClipRef.current.frames.length && poseRingRef.current.length) reviewClipRef.current = { score: averageForm, exerciseId: exercise.id, exerciseName: exercise.name, frames: [...poseRingRef.current] };
    if (!bestClipRef.current.frames.length && poseRingRef.current.length) bestClipRef.current = { score: averageForm, exerciseId: exercise.id, exerciseName: exercise.name, frames: [...poseRingRef.current] };
    const xp = completeWorkout({
      reps: sessionReps,
      formScore: averageForm,
      repQualityAverage: averageForm,
      fatigueScore: peakFatigueScore,
      fatigueEvents,
      readinessScore: Number(readiness?.score || 0),
      readinessBand: readiness?.band || '',
      planVersion: personalizedPlan?.planVersion || '',
      durationSeconds: sessionSeconds,
      caloriesBurned: liveCalories,
      calorieTarget: plannedCalories,
      exerciseCalories: Object.fromEntries(Object.entries(exerciseActiveSeconds).map(([id, seconds]) => [id, Math.round(caloriesFromExerciseSeconds({ [id]: seconds }, catalog, profile))])),
      exercises: sessionExercises.map((item) => item.id),
      formReport: report,
    });
    setEarned(xp);
    setPaused(true);
    setPhase('complete');
    const focusLine = report.focus ? ` Your next technique focus is ${report.focus.name}. ${report.focusTip}` : '';
    speakCoach(`${firstName}, workout complete. You burned about ${liveCalories} calories. Your average form was ${averageForm} percent, with a ${report.consistency} percent consistency score.${focusLine}`, 0, { force: true });
  };

  const finishExercise = () => {
    setCompletedExercises((current) => (current.includes(exercise.id) ? current : [...current, exercise.id]));
    const hasNextExercise = exerciseIndex < sessionExercises.length - 1;
    if (!hasNextExercise) {
      finishSession();
      return;
    }
    const nextExercise = sessionExercises[exerciseIndex + 1];
    startRest({
      seconds: adaptiveExerciseRest,
      title: `Next: ${nextExercise.name}`,
      next: moveToNextExercise,
    });
  };

  const completeSet = () => {
    if (setNumber < config.sets) {
      startRest({
        seconds: adaptiveSetRest,
        title: `Set ${setNumber} complete`,
        next: moveToNextSet,
      });
      return;
    }
    finishExercise();
  };

  const registerRep = (event = { type: 'rep' }) => {
    if (paused || phase !== 'active') return;
    if (config.mode === 'ai-practice') return;
    if (config.mode === 'hold' && event.type !== 'hold') return;
    if (config.mode === 'reps' && event.type === 'hold') return;

    // Once the custom temporal model has enough evidence, it becomes a second
    // validation gate on top of the geometry/state-machine counter. This is
    // what stops a random bend from being accepted as the selected exercise.
    const aiCoversExercise = customAI.labels.includes(exercise.id);
    const aiEvidenceReady = customAI.modelReady && aiCoversExercise && cameraState.classifierSafe !== false && (customAI.prediction.rawConfidence || 0) >= 0.52;
    const aiMatchesExercise = customAI.prediction.label === exercise.id;
    if (aiEvidenceReady && !aiMatchesExercise) {
      const seen = customAI.prediction.label === 'unknown' ? 'a different movement' : customAI.prediction.displayName;
      speakCoach(`Reset for ${exercise.name}. I am seeing ${seen}, so I will not count that rep.`, 2800);
      return;
    }

    const repQuality = Math.round(event?.evaluation?.formScore || formScore || 0);
    recordFormSample(repQuality);
    if (repQuality) recordExerciseRep(repQuality, event?.evaluation?.feedback || tracking.feedback || '');
    if (event.type === 'rep' && repQuality) {
      setLastRepQuality(repQuality);
      setRecentRepQuality((values) => [...values.slice(-4), repQuality]);
    }
    setSessionReps((value) => value + (config.mode === 'reps' ? 1 : 0));
    setReps((current) => {
      if (current >= config.target) return current;
      const next = current + 1;
      const remaining = Math.max(0, config.target - next);
      const strongPhrases = ['That one was clean.', 'Nice control.', 'Good rhythm.', 'Strong rep.'];
      const goodPhrases = ['Good. Keep that path.', 'Nice. Make the next one match it.', 'Controlled rep.', 'Good work. Stay smooth.'];
      const cue = repQuality >= 92 ? strongPhrases[next % strongPhrases.length] : repQuality >= 84 ? goodPhrases[next % goodPhrases.length] : event?.evaluation?.feedback || 'Reset your form for the next rep.';
      if (event.type === 'rep') {
        if (next === Math.ceil(config.target / 2)) {
          speakCoach(`${next}. You are halfway. ${COACH_TIPS[exercise.id]?.halfway || 'Keep the movement controlled.'}`, 900);
        } else if (remaining === 1) {
          speakCoach(`${next}. One more. Keep it clean.`, 700);
        } else if (next <= 2 || remaining <= 2 || next % 5 === 0 || repQuality < 78) {
          speakCoach(`${next}. ${cue}`, repQuality < 78 ? 900 : 1250);
        }
      }
      if (next >= config.target) {
        window.setTimeout(completeSet, 120);
        return config.target;
      }
      return next;
    });
  };

  const skipRest = () => {
    const next = restNextRef.current;
    restNextRef.current = null;
    next?.();
  };


  const toggleVoiceCommands = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceCommandStatus('Voice commands are not supported by this browser. Chrome/Edge desktop works best.');
      return;
    }
    if (voiceCommandsWantedRef.current) {
      voiceCommandsWantedRef.current = false;
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
      setVoiceCommandsEnabled(false);
      setVoiceCommandStatus('Voice commands off.');
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      if (voiceSpeakingRef.current || Date.now() < ignoreRecognitionUntilRef.current) return;
      const transcript = String(event.results?.[event.results.length - 1]?.[0]?.transcript || '').trim().toLowerCase();
      if (!transcript || transcript.split(/\s+/).length > 5) return;
      setVoiceCommandStatus(`Heard: “${transcript}”`);
      if (transcript.includes('pause') && workoutPhaseRef.current === 'active') {
        setPaused(true); speakCoach('Paused. Say resume when you are ready.', 0, { force: true });
      } else if (transcript.includes('resume') && workoutPhaseRef.current === 'active') {
        setPaused(false); speakCoach('Back with you. Resume with a clean setup.', 0, { force: true });
      } else if ((transcript.includes('skip rest') || transcript === 'skip') && workoutPhaseRef.current === 'rest') {
        speakCoach('Skipping recovery. Set your stance before you move.', 0, { force: true }); skipRest();
      } else if (transcript.includes('repeat cue') || transcript.includes('repeat')) {
        speakCoach(trackingStateRef.current?.feedback || COACH_TIPS[exerciseStateRef.current?.id]?.start || 'Move with control.', 0, { force: true });
      }
    };
    recognition.onerror = (event) => {
      if (event?.error !== 'aborted' && event?.error !== 'no-speech') setVoiceCommandStatus(`Voice command error: ${event?.error || 'microphone unavailable'}`);
    };
    recognition.onend = () => {
      if (!voiceCommandsWantedRef.current) return;
      try { recognition.start(); } catch { /* browser may already be restarting */ }
    };
    recognitionRef.current = recognition;
    voiceCommandsWantedRef.current = true;
    setVoiceCommandsEnabled(true);
    setVoiceCommandStatus('Listening: pause · resume · skip rest · repeat cue');
    try { recognition.start(); } catch { setVoiceCommandStatus('Could not start microphone voice commands.'); }
  };

  useEffect(() => () => {
    voiceCommandsWantedRef.current = false;
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel?.();
    stopFocusBeat();
  }, []);

  const restartSession = () => {
    completionLock.current = false;
    restNextRef.current = null;
    setPhase('setup');
    setExerciseIndex(0);
    setSetNumber(1);
    setReps(0);
    setPaused(false);
    setTracking(EMPTY_TRACKING);
    setCountdown(3);
    setRestSeconds(0);
    setSessionReps(0);
    setFormSamples([]);
    setSessionSeconds(0);
    setExerciseActiveSeconds({});
    setEarned(0);
    setCompletedExercises([]);
    setLastRepQuality(null);
    setRecentRepQuality([]);
    setFatigueEvents(0);
    setPeakFatigueScore(0);
    setFormReport(null);
    setReplayChoice('review');
    poseRingRef.current = [];
    bestClipRef.current = { score: -1, exerciseId: '', exerciseName: '', frames: [] };
    reviewClipRef.current = { score: 101, exerciseId: '', exerciseName: '', frames: [] };
    exerciseStatsRef.current = {};
    fatigueAlertedRef.current = false;
    safetyAlertedRef.current = false;
    preflightSpokenRef.current = false;
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button'].includes(tag) || event.target?.isContentEditable) return;
      if (event.code === 'Space' && phase === 'active') {
        event.preventDefault();
        togglePause();
      } else if (event.key?.toLowerCase() === 'r' && phase === 'active') {
        resetCurrentSet();
        speakCoach('Current set restarted. Take your opening position when you are ready.', 0, { force: true });
      } else if (event.key?.toLowerCase() === 'm') {
        setMusicEnabled((value) => !value);
      } else if (event.key === 'Escape' && phase !== 'complete') {
        navigate('/dashboard');
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [phase, paused, navigate]);

  const averageForm = formSamples.length
    ? Math.round(formSamples.reduce((sum, score) => sum + score, 0) / formSamples.length)
    : Math.max(70, formScore || 80);
  const minutes = Math.floor(sessionSeconds / 60);
  const seconds = String(sessionSeconds % 60).padStart(2, '0');
  const replayClip = replayChoice === 'best' ? bestClipRef.current : reviewClipRef.current;

  return (
    <div ref={workoutRootRef} className="workout-page workout-v2 workout-session-v3">
      <div className="workout-topbar">
        <div><span className="live-dot" /> LIVE WORKOUT</div>
        <strong>Exercise {exerciseIndex + 1} / {sessionExercises.length} · {exercise.name}</strong>
        <button onClick={() => navigate('/dashboard')}><X size={18} /> End session</button>
      </div>

      <div className="session-progress-strip">
        <span style={{ width: `${phase === 'complete' ? 100 : Math.max(4, sessionProgress)}%` }} />
      </div>

      <div className="workout-layout">
        <section className="workout-main session-camera-shell">
          <CameraStage
            exerciseId={exercise.trackerTemplate && exercise.trackerTemplate !== 'classifier-only' ? exercise.trackerTemplate : exercise.id}
            paused={paused || phase !== 'active'}
            onRep={registerRep}
            onTrackingData={setTracking}
            onCameraState={setCameraState}
            onLandmarks={customAI.pushLandmarks}
            onPoseFrame={handlePoseFrame}
            alignmentEnabled={alignmentEnabled}
            showSkeleton={showSkeleton}
            coachName={coachName}
            startRequest={cameraStartRequest}
            showStartPrompt={false}
          />

          {phase !== 'setup' && <div className="mobile-workout-hud">
            <span><small>REPS</small><strong>{reps}<em>/{config.target}</em></strong></span>
            <span><small>SET</small><strong>{setNumber}<em>/{config.sets}</em></strong></span>
            <span><small>FORM</small><strong>{formScore ? `${formScore}%` : '—'}</strong></span>
            <span><small>CAL</small><strong>{liveCalories}</strong></span>
          </div>}

          <div className="live-feedback-row live-feedback-v2">
            <div>
              <span className={`feedback-light ${formScore >= 80 ? 'good' : ''}`} />
              <small>LIVE FORM CUE</small>
              <strong>{paused && phase === 'active' ? 'Session paused' : tracking.feedback}</strong>
            </div>
            <div className="tracking-chip"><ScanLine /><span><small>NOW DOING</small><strong>{exercise.name}</strong></span></div>
            <button disabled={phase !== 'active'} onClick={togglePause}><CirclePause /> {paused ? 'Resume' : 'Pause'}</button>
            <button className={showSkeleton ? 'voice-enabled' : ''} onClick={() => setShowSkeleton((value) => !value)}>{showSkeleton ? <Eye /> : <EyeOff />} Skeleton {showSkeleton ? 'on' : 'off'}</button>
            <button className={musicEnabled ? 'voice-enabled' : ''} onClick={() => setMusicEnabled((value) => !value)}><Music /> Beat {musicEnabled ? 'on' : 'off'}</button>
            <button className={workoutFullscreen ? 'voice-enabled' : ''} onClick={toggleWorkoutFullscreen}><Maximize2 /> Full screen</button>
            <button className={voiceEnabled ? 'voice-enabled' : ''} onClick={() => { setVoiceEnabled((value) => !value); if (voiceEnabled) window.speechSynthesis?.cancel?.(); }}><Volume2 /> Voice {voiceEnabled ? 'on' : 'off'}</button>
          </div>
          <div className="workout-shortcut-hint"><span><kbd>Space</kbd> pause</span><span><kbd>R</kbd> restart set</span><span><kbd>M</kbd> beat</span><span><kbd>Esc</kbd> exit</span></div>

          <AnimatePresence mode="wait">
            {phase === 'setup' && (
              <motion.div className="session-overlay preflight-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="session-overlay-card checklist-card preflight-card">
                  <span className="eyebrow">BEFORE YOU START</span>
                  <h2>Quick workout check</h2>
                  <p>Make sure the camera can see the joints used for this exercise and that you have room to move. Jumping jacks can use compact camera mode if your hands go above the frame.</p>
                  {readiness ? <div className={`preflight-readiness ${readiness.band}`}><BatteryCharging /><span><strong>Today score {readiness.score}/100</strong><small>{readiness.message || `Today is a ${readiness.band} session.`}</small></span><Check /></div> : <button className="preflight-readiness missing" onClick={() => navigate('/readiness?next=workout')}><BatteryCharging /><span><strong>Quick check needed</strong><small>Tell us how you feel so today’s pace and rest can be adjusted.</small></span><ChevronRight /></button>}
                  <div className="preflight-list">
                    <button className={cameraResponsive ? 'ready' : cameraState.modelState === 'loading' ? 'checking' : ''} onClick={requestCamera} disabled={cameraState.modelState === 'loading'}><Camera /><span><strong>Camera</strong><small>{cameraResponsive ? 'Camera ready' : cameraState.modelState === 'loading' ? 'Preparing camera…' : cameraState.modelState === 'error' ? cameraState.status : 'Tap to allow camera access'}</small></span><Check /></button>
                    <div className={bodyReady ? 'ready' : cameraResponsive ? 'checking' : ''}><ScanLine /><span><strong>Body position</strong><small>{bodyReady ? 'Camera has seen the working joints' : cameraResponsive ? 'Move into frame until the tracker locks once' : 'Starts after the camera is ready'}</small></span><Check /></div>
                    <button className={lightReady ? 'ready' : ''} onClick={() => setLightReady((value) => !value)}><Lightbulb /><span><strong>Lighting</strong><small>I can see myself clearly</small></span><Check /></button>
                    <button className={spaceReady ? 'ready' : ''} onClick={() => setSpaceReady((value) => !value)}><ShieldCheck /><span><strong>Safe space</strong><small>I have enough room to move</small></span><Check /></button>
                  </div>
                  <button className="button button-full" disabled={!setupReady} onClick={startCountdown}><Play /> Start workout</button>
                  <small className="setup-note">Start becomes available once the camera is ready and you confirm lighting and safe space. Body position is checked live and can lock in during the countdown. The daily check-in improves pacing, but it will not block your workout.</small>
                </div>
              </motion.div>
            )}

            {phase === 'countdown' && (
              <motion.div className="session-overlay countdown-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div key={countdown} className="countdown-number" initial={{ scale: .55, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{countdown || 'GO'}</motion.div>
                <span>{exercise.name} · Set {setNumber}</span>
              </motion.div>
            )}

            {phase === 'rest' && (
              <motion.div className="session-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="session-overlay-card rest-card">
                  <Timer />
                  <span className="eyebrow">RECOVERY</span>
                  <h2>{restTitle}</h2>
                  <strong className="rest-count">{restSeconds}s</strong>
                  <p>Relax your shoulders, breathe, and take a sip of water.</p>
                  <button className="button button-full button-secondary" onClick={skipRest}>Skip rest <ChevronRight /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="workout-sidebar">
          <section className="current-exercise-card">
            <span className="eyebrow">CURRENT EXERCISE</span>
            <h1>{exercise.name}</h1>
            <p>{exercise.target}</p>
            <div className="rep-dial" style={{ '--progress': `${progress * 3.6}deg` }}>
              <div><strong>{reps}</strong><span>/ {config.target} {config.unit}</span></div>
            </div>
            <div className="set-row"><span>SET {setNumber} OF {config.sets}</span><div>{Array.from({ length: config.sets }, (_, index) => <i className={index + 1 <= setNumber ? 'active' : ''} key={index} />)}</div></div>
            <div className="workout-calorie-row"><Flame /><span><small>ESTIMATED CALORIES</small><strong>{liveCalories} / {plannedCalories || '—'} kcal</strong></span></div>
            <div className="auto-counter-note"><ScanLine /><div><strong>Camera counting is active</strong><small>{config.mode === 'hold' ? 'Hold time increases only while your plank form is trackable.' : 'A rep is added only after a complete movement cycle.'}</small></div></div>
            <div className={`rep-quality-card ${lastRepQuality >= 90 ? 'excellent' : lastRepQuality >= 80 ? 'good' : lastRepQuality ? 'adjust' : ''}`}>
              <div><Gauge /><span><small>LAST REP</small><strong>{lastRepQuality ? `${lastRepQuality}%` : '--'}</strong></span></div>
              <p>{lastRepQuality ? (lastRepQuality >= 90 ? 'Excellent control and alignment.' : lastRepQuality >= 80 ? 'Good rep. Keep the same movement path.' : 'Rep counted, but adjust your form on the next one.') : 'Each completed rep gets a form score from the movement your camera sees.'}</p>
              {recentRepQuality.length > 0 && <div className="rep-quality-history">{recentRepQuality.map((score, index) => <i key={`${score}-${index}`} style={{ height: `${Math.max(18, score)}%` }} title={`${score}%`} />)}</div>}
            </div>
            {safetyConcern && <div className="workout-safety-check"><TriangleAlert /><div><strong>Reset your position</strong><small>Your last few reps lost a lot of form. Slow down or take a break. Stop if the movement hurts or feels wrong.</small></div></div>}
          </section>

          <div className='flex flex-col'>
            <section className="form-metrics">
            <div><span><Gauge /> Live form score</span><strong>{formScore ? `${formScore}%` : '—'}</strong></div>
            <div className="metric-track"><span style={{ width: `${formScore}%` }} /></div>
            <div className="angle-readouts">
              <span><small>{tracking.metricLabel || 'MOVEMENT CHECK'}</small><strong>{tracking.metric ? `${tracking.metric.toFixed(['jumping-jack', 'high-knees'].includes(exercise.id) ? 2 : 0)}${['jumping-jack', 'high-knees'].includes(exercise.id) ? '×' : '°'}` : '—'}</strong></span>
              <span><small>WORKOUT TIME</small><strong>{minutes}:{seconds}</strong></span>
            </div>
            {tracking.regionScores && <div className="body-part-scores">
              {[['shoulder','Shoulders'],['hip','Hips'],['knee','Knees'],['back','Back']].map(([key,label]) => <span key={key}><small>{label}</small><strong>{Number.isFinite(tracking.regionScores[key]) ? `${tracking.regionScores[key]}%` : '—'}</strong></span>)}
            </div>}
          </section>
          <section className="visual-coach-card">
            <div><BarChart3 /><span><small>FORM GUIDE</small><strong>Simple alignment help</strong></span></div>
            <div className="visual-coach-toggles">
              <button className={alignmentEnabled ? 'active' : ''} onClick={()=>setAlignmentEnabled((value)=>!value)}>Guide lines {alignmentEnabled ? 'ON' : 'OFF'}</button>
              <button className={showSkeleton ? 'active' : ''} onClick={()=>setShowSkeleton((value)=>!value)}>My skeleton {showSkeleton ? 'ON' : 'OFF'}</button>
            </div>
            <p>Guide lines and your optional skeleton help you see alignment. Your temporary pose replay stays in this browser; webcam video is not saved.</p>
          </section>

          <section className="exercise-queue session-queue">
            <span className="eyebrow">TODAY'S SESSION</span>
            {sessionExercises.map((item, index) => (
              <div className={`${index === exerciseIndex ? 'active' : ''} ${completedExercises.includes(item.id) ? 'done' : ''}`} key={item.id}>
                <span>{completedExercises.includes(item.id) ? <Check /> : index + 1}</span>
                <div><strong>{item.name}</strong><small>{(() => { const dose = planSession?.exercises?.find((entry) => entry.id === item.id); const fallback = EXERCISE_CONFIG[item.id] || { sets: item.sets || 3, target: item.baseTarget || 10, unit: item.trackingMode === 'hold' ? 'sec' : 'reps' }; return `${dose?.sets || fallback.sets} sets · ${dose?.target || fallback.target} ${dose?.unit || fallback.unit}`; })()}</small></div>
              </div>
            ))}
          </section>
          </div>

          <section className={`adaptive-coach-card ${fatigue.band} ${readiness?.band || 'no-readiness'}`}>
            <div className="adaptive-coach-heading"><BatteryCharging /><span><small>TODAY'S PACE</small><strong>{readiness ? `${readiness.score}/100 today score` : 'Quick check not done'}</strong></span></div>
            <div className="adaptive-coach-grid">
              <span><small>ENERGY / FORM</small><strong>{fatigue.label}</strong></span>
              <span><small>NEXT REST</small><strong>{adaptiveSetRest}s</strong></span>
              <span><small>FORM CHANGE</small><strong>{fatigue.drop ? `${fatigue.drop} pts` : '—'}</strong></span>
            </div>
            <p>{fatigue.band === 'high' ? 'Recent rep quality is falling, so ScanRig will extend recovery automatically.' : readiness?.message || 'Complete the quick check before training so ScanRig can choose a sensible pace and rest time.'}</p>
          </section>

          <section className="coach-voice-card">
            <div className="coach-voice-heading"><AudioLines /><span><small>{coachName.toUpperCase()} LIVE VOICE</small><strong>{voiceEnabled ? `${voiceStyle} coaching` : 'Voice muted'}</strong></span></div>
            <div className="coach-voice-controls">
              <button className={voiceEnabled ? 'active' : ''} onClick={() => { setVoiceEnabled((value) => !value); if (voiceEnabled) window.speechSynthesis?.cancel?.(); }}><Volume2 /> {voiceEnabled ? 'Coach speaking' : 'Turn voice on'}</button>
              <select value={voiceStyle} onChange={(event)=>setVoiceStyle(event.target.value)} aria-label="Coach voice style">
                <option value="calm">Calm</option>
                <option value="balanced">Balanced</option>
                <option value="energetic">Energetic</option>
              </select>
            </div>
            <button className={`voice-command-button ${voiceCommandsEnabled ? 'listening' : ''}`} onClick={toggleVoiceCommands}><Mic2 /> {voiceCommandsEnabled ? 'Voice commands listening' : 'Enable voice commands'}</button>
            <small className="voice-command-status">{voiceCommandStatus}</small>
          </section>

          

          
        </aside>
      </div>

      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div className="modal-backdrop report-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="completion-modal session-summary-modal stage23-report-modal" initial={{ opacity: 0, scale: .92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
              <div className="report-hero-row">
                <span className="reward-icon"><Award /></span>
                <div><small>YOUR FORM REPORT</small><h2>Session report · Grade {formReport?.grade || '—'}</h2><p>{formReport?.coachSummary || `You finished ${sessionExercises.length} exercises with camera-assisted tracking.`}</p></div>
              </div>
              <div className="completion-stats stage23-completion-stats">
                <span><strong>{minutes}:{seconds}</strong><small>TIME</small></span>
                <span><strong>{sessionReps}</strong><small>REPS</small></span>
                <span><strong>{liveCalories}</strong><small>EST. KCAL</small></span>
                <span><strong>{averageForm}%</strong><small>FORM</small></span>
                <span><strong>{formReport?.consistency || 0}%</strong><small>CONSISTENCY</small></span>
                <span><strong>{peakFatigueScore || 0}</strong><small>ENERGY / FORM</small></span>
                <span><strong>+{earned}</strong><small>XP</small></span>
              </div>

              <div className="form-report-grid">
                <section className="form-report-panel">
                  <span className="eyebrow">REP QUALITY</span>
                  <div className="quality-buckets">
                    <div><strong>{formReport?.strongReps || 0}</strong><small>90–100 · STRONG</small></div>
                    <div><strong>{formReport?.goodReps || 0}</strong><small>80–89 · GOOD</small></div>
                    <div><strong>{formReport?.adjustReps || 0}</strong><small>&lt;80 · ADJUST</small></div>
                  </div>
                  <div className="report-highlight"><strong>Strongest</strong><span>{formReport?.strongest?.name || 'Building signal'}{formReport?.strongest?.average ? ` · ${formReport.strongest.average}%` : ''}</span></div>
                  <div className="report-highlight focus"><strong>Next focus</strong><span>{formReport?.focus?.name || 'Movement consistency'}{formReport?.focus?.average ? ` · ${formReport.focus.average}%` : ''}</span></div>
                  <p className="report-coach-tip"><Sparkles /> {formReport?.focusTip || 'Keep each repetition controlled and repeatable.'}</p>
                  {!!formReport?.exerciseBreakdown?.length && <div className="exercise-report-list">{formReport.exerciseBreakdown.map((item)=><div key={item.id}><span>{item.name}<small>{item.reps} tracked</small></span><strong>{item.average || '—'}%</strong></div>)}</div>}
                </section>

                <section className="form-report-panel replay-panel">
                  <div className="replay-tab-row">
                    <button className={replayChoice === 'review' ? 'active' : ''} onClick={()=>setReplayChoice('review')}>Technique review</button>
                    <button className={replayChoice === 'best' ? 'active' : ''} onClick={()=>setReplayChoice('best')}>Best movement</button>
                  </div>
                  <PoseReplay clip={replayClip.frames} exerciseId={replayClip.exerciseId || exercise.id} exerciseName={replayClip.exerciseName || exercise.name} title={replayChoice === 'best' ? `Best captured form · ${replayClip.score > 0 ? `${replayClip.score}%` : ''}` : `Review clip · ${replayClip.score < 101 ? `${replayClip.score}%` : ''}`} />
                </section>
              </div>

              <div className="report-footer-actions">
                <button className="button" onClick={() => navigate('/dashboard')}><Sparkles /> Back to dashboard</button>
                <button className="button button-secondary" onClick={() => navigate('/progress')}><BarChart3 /> Open progress report</button>
                <button className="text-button reset-button" onClick={restartSession}><RotateCcw /> Repeat session</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
