import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit, Camera, CheckCircle2, Database, Download, Dumbbell, FlaskConical,
  Play, Plus, RefreshCw, Save, ShieldCheck, Trash2, UserRound, WandSparkles,
} from 'lucide-react';
import CameraStage from '../components/CameraStage';
import TrainerShowcase3D from '../components/TrainerShowcase3D';
import { EXERCISE_AI_LABELS, EXERCISE_AI_NAMES } from '../ai/exerciseLabels';
import { createRecording, DEFAULT_SAMPLE_HZ, normalizePoseLandmarks } from '../ai/poseFeatures';
import useExerciseClassifier from '../ai/useExerciseClassifier';
import {
  createAdminExercise,
  deleteAdminExercise,
  deleteTrainingSample,
  getAdminExercises,
  getAIModelStatus,
  getAITrainingStatus,
  getTrainingDatasetExport,
  getTrainingSamples,
  getTrainingSampleSummary,
  saveTrainingSample,
  startAITraining,
  updateAdminExercise,
  updateTrainingSample,
} from '../services/api';

const RECORD_SECONDS = 4;
const CORE_HINTS = {
  'jumping-jack': 'Perform 3–5 complete jumping jacks at a natural pace. Keep hands and feet in frame.',
  'high-knees': 'Alternate knees at a steady pace. Include normal and slightly faster examples.',
  'biceps-curl': 'Perform controlled hammer curls. Add examples with light dumbbells and without weights.',
  squat: 'Perform several clean squats. Include front and slight-side views over time.',
  'shoulder-press': 'Press both hands overhead with a stable torso. Light dumbbells or bottles are fine.',
  'push-up': 'Use a side view. Record standard and knee push-ups as valid examples.',
  lunge: 'Perform alternating lunges with the front knee and hip visible.',
  crunch: 'Record side-on while lying on a mat. Keep shoulders, hips and knees visible.',
  plank: 'Hold a clean plank with small natural movement. Side view works best.',
  unknown: 'Record standing, waving, walking, sideways bending, incomplete reps and deliberately wrong exercise-like movements.',
};

const EMPTY_NEW_EXERCISE = {
  name: '', category: 'Upper body', difficulty: 'Beginner', target: '', equipment: 'No equipment',
  duration: '3 sets × 10 reps', description: '', youtubeUrl: '', instructions: '', commonMistakes: '',
  primaryMuscles: '', secondaryMuscles: '', accent: 'cyan', icon: '◆', trackingMode: 'classifier-only',
  trackerTemplate: 'classifier-only', baseTarget: 10, sets: 3, sampleGoal: 25,
};

function prettyLabel(label, names = {}) {
  return names[label] || EXERCISE_AI_NAMES[label] || String(label || '').replaceAll('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AILabPage() {
  const [exerciseCatalog, setExerciseCatalog] = useState({ core: [], custom: [] });
  const [selectedLabel, setSelectedLabel] = useState('jumping-jack');
  const [cameraStartRequest, setCameraStartRequest] = useState(0);
  const [cameraState, setCameraState] = useState({ active: false, bodyVisible: false });
  const [phase, setPhase] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [recordRemaining, setRecordRemaining] = useState(RECORD_SECONDS);
  const [participantName, setParticipantName] = useState('');
  const [participantGender, setParticipantGender] = useState('male');
  const [trainerPersona, setTrainerPersona] = useState('james');
  const [cameraView, setCameraView] = useState('front');
  const [message, setMessage] = useState('Choose an exercise, trainer profile, and contributor, then add a real movement sample.');
  const [summary, setSummary] = useState({ total: 0, counts: {}, statuses: {}, genders: {} });
  const [samples, setSamples] = useState([]);
  const [sampleTotal, setSampleTotal] = useState(0);
  const [filterLabel, setFilterLabel] = useState('all');
  const [loadingData, setLoadingData] = useState(true);
  const [trainingJob, setTrainingJob] = useState({ running: false, stage: 'idle', logs: [] });
  const [modelStatus, setModelStatus] = useState({ installed: false, classCount: 0, labels: [] });
  const [showCreate, setShowCreate] = useState(false);
  const [newExercise, setNewExercise] = useState(EMPTY_NEW_EXERCISE);
  const framesRef = useRef([]);
  const recordingRef = useRef(false);
  const lastFrameAtRef = useRef(0);
  const sessionIdRef = useRef(`admin-collector-${new Date().toISOString().slice(0, 10)}`);
  const classifier = useExerciseClassifier();


  const effectiveModelStatus = useMemo(() => {
    if (modelStatus.installed) return modelStatus;

    // The production browser model is bundled with the frontend.
    // If ONNX Runtime Web loaded it successfully, treat it as active even
    // when the backend has no server-side training model installed.
    if (classifier.status === 'ready') {
      return {
        installed: true,
        modelVersion:
          classifier.modelInfo?.version ||
          classifier.modelInfo?.modelVersion ||
          classifier.modelInfo?.modelHash ||
          null,
        exportedAt:
          classifier.modelInfo?.exportedAt ||
          classifier.modelInfo?.createdAt ||
          null,
        classCount:
          classifier.modelInfo?.classCount ||
          classifier.labels?.length ||
          0,
        labels: classifier.labels || [],
        testAccuracy:
          classifier.modelInfo?.testAccuracy ??
          classifier.modelInfo?.accuracy ??
          null,
        splitMode:
          classifier.modelInfo?.splitMode ||
          classifier.modelInfo?.evaluationMode ||
          null,
        datasetSamples:
          classifier.modelInfo?.datasetSamples ??
          classifier.modelInfo?.samples ??
          null,
        sourceCounts: classifier.modelInfo?.sourceCounts || {},
        maxParityDifference:
          classifier.modelInfo?.maxParityDifference ??
          classifier.modelInfo?.parityError ??
          null,
      };
    }

    return modelStatus;
  }, [modelStatus, classifier.status, classifier.modelInfo, classifier.labels]);
  useEffect(() => {
    setTrainerPersona(participantGender === 'female' ? 'jody' : 'james');
  }, [participantGender]);

  const allExercises = useMemo(() => [
    ...(exerciseCatalog.core || []),
    ...(exerciseCatalog.custom || []),
    { id: 'unknown', name: 'Unknown / invalid movement', sampleGoal: 40, status: 'published', syntheticAvailable: true, isCustom: false },
  ], [exerciseCatalog]);
  const names = useMemo(() => Object.fromEntries(allExercises.map((item) => [item.id, item.name])), [allExercises]);
  const selectedExercise = allExercises.find((item) => item.id === selectedLabel) || allExercises[0];
  const labels = allExercises.map((item) => item.id);
  const counts = summary.counts || {};

  const refresh = useCallback(async () => {
    setLoadingData(true);
    try {
      const [nextSummary, samplePage, catalog, nextModelStatus] = await Promise.all([
        getTrainingSampleSummary(),
        getTrainingSamples({ limit: 40, ...(filterLabel !== 'all' ? { label: filterLabel } : {}) }),
        getAdminExercises(),
        getAIModelStatus().catch(() => ({ installed: false, classCount: 0, labels: [] })),
      ]);
      setSummary(nextSummary);
      setSamples(samplePage.samples || []);
      setSampleTotal(samplePage.total || 0);
      setExerciseCatalog(catalog || { core: [], custom: [] });
      setModelStatus(nextModelStatus || { installed: false, classCount: 0, labels: [] });
      if (!selectedLabel && catalog?.core?.[0]?.id) setSelectedLabel(catalog.core[0].id);
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Could not load the AI Lab data from the server.');
    } finally {
      setLoadingData(false);
    }
  }, [filterLabel, selectedLabel]);

  useEffect(() => { refresh(); }, [filterLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const response = await getAITrainingStatus();
        const job = response?.job || response || { running: false, stage: 'idle', logs: [] };
        if (cancelled) return;
        setTrainingJob(job);
        if (job?.running) timer = window.setTimeout(poll, 1800);
      } catch { /* collection still works without Python configured */ }
    };
    poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  const handleLandmarks = (landmarks, now) => {
    classifier.pushLandmarks(landmarks, now);
    if (!recordingRef.current) return;
    const sampleEvery = 1000 / DEFAULT_SAMPLE_HZ;
    if (now - lastFrameAtRef.current < sampleEvery) return;
    const frame = normalizePoseLandmarks(landmarks);
    if (!frame) return;
    lastFrameAtRef.current = now;
    framesRef.current.push(frame);
  };

  const startRecording = () => {
    if (!participantName.trim()) return setMessage('Enter the contributor’s real name first, for example Rana.');
    if (!cameraState.active) return setMessage('Start the camera first.');
    if (!cameraState.bodyVisible) return setMessage('Move into the frame until the required body landmarks are visible.');
    classifier.reset();
    framesRef.current = [];
    lastFrameAtRef.current = 0;
    setCountdown(3);
    setPhase('countdown');
    setMessage(`Get ready to teach ${prettyLabel(selectedLabel, names)}.`);
  };

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          recordingRef.current = true;
          setRecordRemaining(RECORD_SECONDS);
          setPhase('recording');
          setMessage('Recording movement… keep the complete motion visible.');
          return 0;
        }
        return value - 1;
      });
    }, 850);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const timer = window.setInterval(() => {
      setRecordRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          recordingRef.current = false;
          setPhase('saving');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'saving') return;
    let cancelled = false;
    const save = async () => {
      const notes = selectedExercise?.description || CORE_HINTS[selectedLabel] || `Real ${prettyLabel(selectedLabel, names)} sample collected in the admin lab.`;
      const recording = createRecording({
        label: selectedLabel,
        frames: framesRef.current,
        sessionId: sessionIdRef.current,
        notes,
        participantName: participantName.trim(),
        participantGender,
        trainerPersona,
        cameraView,
      });
      if (!recording || framesRef.current.length < 18) {
        if (!cancelled) { setMessage('Not enough stable pose frames were captured. Stay in view and try again.'); setPhase('idle'); }
        return;
      }
      try {
        await saveTrainingSample(recording);
        await refresh();
        if (!cancelled) setMessage(`${prettyLabel(selectedLabel, names)} sample from ${participantName.trim()} added to the progressive dataset.`);
      } catch (error) {
        if (!cancelled) setMessage(error?.response?.data?.message || 'The sample could not be saved to MongoDB.');
      } finally {
        if (!cancelled) setPhase('idle');
      }
    };
    save();
    return () => { cancelled = true; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const createExercise = async () => {
    try {
      const payload = {
        ...newExercise,
        instructions: newExercise.instructions.split('\n').filter(Boolean),
        commonMistakes: newExercise.commonMistakes.split('\n').filter(Boolean),
        primaryMuscles: newExercise.primaryMuscles.split(',').filter(Boolean),
        secondaryMuscles: newExercise.secondaryMuscles.split(',').filter(Boolean),
      };
      const { exercise } = await createAdminExercise(payload);
      setShowCreate(false);
      setNewExercise(EMPTY_NEW_EXERCISE);
      await refresh();
      setSelectedLabel(exercise.id);
      setMessage(`${exercise.name} created as Draft. Start collecting real samples, then move it to Beta or Published.`);
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Could not create the exercise.');
    }
  };

  const setExerciseStatus = async (exercise, status) => {
    try {
      await updateAdminExercise(exercise.id, { status });
      await refresh();
      setMessage(`${exercise.name} is now ${status}.`);
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Could not change exercise status.');
    }
  };

  const removeExercise = async (exercise) => {
    if (!window.confirm(`Delete ${exercise.name}? It can only be deleted when it has no training samples.`)) return;
    try {
      await deleteAdminExercise(exercise.id);
      if (selectedLabel === exercise.id) setSelectedLabel('jumping-jack');
      await refresh();
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Could not delete exercise.');
    }
  };

  const changeSample = async (sample, patch) => {
    try { await updateTrainingSample(sample.id, patch); await refresh(); }
    catch (error) { setMessage(error?.response?.data?.message || 'Could not update that sample.'); }
  };

  const removeSample = async (sample) => {
    if (!window.confirm(`Delete this ${prettyLabel(sample.label, names)} sample from ${sample.participantName}?`)) return;
    try { await deleteTrainingSample(sample.id); await refresh(); }
    catch (error) { setMessage(error?.response?.data?.message || 'Could not delete that sample.'); }
  };

  const exportDataset = async () => {
    try {
      const payload = await getTrainingDatasetExport();
      downloadJson(payload, `scanrig-progressive-real-dataset-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage(`Exported ${payload.recordings?.length || 0} real samples.`);
    } catch (error) { setMessage(error?.response?.data?.message || 'Could not export the dataset.'); }
  };

  const retrainModel = async () => {
    if (!window.confirm('Retrain ScanRig AI using the synthetic base plus APPROVED real samples, including eligible new exercise classes?')) return;
    try {
      const startResponse = await startAITraining();
      const job = startResponse?.job || startResponse || { running: false, stage: 'idle', logs: [] };
      setTrainingJob(job);
      setMessage('Retraining started. New admin-created classes will be appended to the model when enough real samples exist.');
      const poll = async () => {
        const statusResponse = await getAITrainingStatus();
        const latest = statusResponse?.job || statusResponse || { running: false, stage: 'idle', logs: [] };
        setTrainingJob(latest);
        if (latest?.running) window.setTimeout(poll, 1800);
        else if (latest?.stage === 'ready') {
          await classifier.reloadModel();
          await refresh();
          setMessage(`New ScanRig ONNX model ${latest.modelVersion || ''} is active. No page refresh is required.`);
        } else if (latest?.stage === 'failed') setMessage(`Training failed: ${latest.error || 'check the training log'}`);
      };
      window.setTimeout(poll, 1800);
    } catch (error) { setMessage(error?.response?.data?.message || 'Could not start AI retraining.'); }
  };

  const hint = CORE_HINTS[selectedLabel] || selectedExercise?.description || 'Record complete examples from more than one contributor and camera view before publishing this exercise.';
  const sampleGoal = Number(selectedExercise?.sampleGoal || 25);
  const selectedCount = counts[selectedLabel] || 0;

  return (
    <div className="ai-lab-page">
      <section className="ai-lab-hero">
        <div>
          <span className="eyebrow"><ShieldCheck size={16} /> ADMIN · TRAINER + DATASET STUDIO</span>
          <h1>Teach ScanRig new movement, one real trainer sample at a time.</h1>
          <p>Choose James or Jody, record named contributors, extend existing classes, create new exercises, and control whether each new exercise is Draft, Beta, or Published.</p>
        </div>
        <div className="ai-training-score"><small>REAL DATASET</small><strong>{summary.total || 0}</strong><span>{summary.genders?.male || 0} male · {summary.genders?.female || 0} female samples</span></div>
      </section>

      <section className="ai-persona-strip">
        <div className="ai-persona-preview"><TrainerShowcase3D gender={trainerPersona === 'jody' ? 'female' : 'male'} animation="defaultIdle" /></div>
        <div className="ai-persona-controls">
          <span className="eyebrow"><UserRound size={15} /> WHO IS TEACHING?</span>
          <div className="ai-persona-buttons">
            <button className={trainerPersona === 'james' ? 'selected' : ''} onClick={() => { setTrainerPersona('james'); setParticipantGender('male'); }}>JAMES <small>Male trainer profile</small></button>
            <button className={trainerPersona === 'jody' ? 'selected' : ''} onClick={() => { setTrainerPersona('jody'); setParticipantGender('female'); }}>JODY <small>Female trainer profile</small></button>
          </div>
          <div className="ai-collector-meta ai-collector-meta-wide">
            <label><span>Contributor name</span><input value={participantName} onChange={(e) => setParticipantName(e.target.value)} placeholder="Rana" disabled={phase !== 'idle'} /></label>
            <label><span>Contributor gender</span><select value={participantGender} onChange={(e) => setParticipantGender(e.target.value)} disabled={phase !== 'idle'}><option value="male">Male</option><option value="female">Female</option><option value="other">Other / prefer not to say</option></select></label>
            <label><span>Camera view</span><select value={cameraView} onChange={(e) => setCameraView(e.target.value)} disabled={phase !== 'idle'}><option value="front">Front</option><option value="slight-left">Slight left</option><option value="slight-right">Slight right</option><option value="side">Side</option></select></label>
          </div>
        </div>
      </section>

      <section className="ai-lab-grid">
        <div className="ai-lab-camera-card">
          <CameraStage exerciseId={selectedLabel} engineLabel="TRAINER DATA CAPTURE" onLandmarks={handleLandmarks} onCameraState={setCameraState} startRequest={cameraStartRequest} />
          <div className="ai-live-classifier"><div><small>CURRENT MODEL CHECK</small><strong>{classifier.status === 'ready' ? classifier.prediction.displayName : 'Collection mode'}</strong></div><span className={classifier.status === 'ready' ? 'ready' : ''}>{classifier.status === 'ready' ? `${Math.round(classifier.prediction.confidence * 100)}%` : 'REAL DATA'}</span></div>
        </div>

        <aside className="ai-lab-controls">
          <div className="ai-lab-section-title"><span>01</span><div><small>EXERCISE CLASS</small><h2>Choose what you are teaching</h2></div></div>
          <div className="ai-label-grid ai-label-grid-scroll">
            {allExercises.map((exercise) => (
              <button key={exercise.id} className={selectedLabel === exercise.id ? 'selected' : ''} onClick={() => setSelectedLabel(exercise.id)} disabled={phase !== 'idle'}>
                <span>{exercise.name}</span><small>{counts[exercise.id] || 0} real · {exercise.status === 'published' ? 'LIVE' : String(exercise.status || 'core').toUpperCase()}</small>
                {(counts[exercise.id] || 0) >= Number(exercise.sampleGoal || 25) && <CheckCircle2 size={15} />}
              </button>
            ))}
          </div>
          <button className="ai-create-trigger" onClick={() => setShowCreate((v) => !v)}><Plus size={16} /> Create a new exercise</button>
          <div className="ai-collection-hint"><WandSparkles size={18} /><p>{hint}</p></div>
          <div className="ai-record-panel">
            {phase === 'countdown' && <strong className="ai-countdown">{countdown}</strong>}
            {phase === 'recording' && <strong className="ai-recording-pulse">REC {recordRemaining}s</strong>}
            {phase === 'saving' && <strong>Adding sample…</strong>}
            {phase === 'idle' && <p>{message}</p>}
            {!cameraState.active ? <button className="button" onClick={() => setCameraStartRequest((v) => v + 1)}><Camera size={18} /> Start camera</button> : <button className="button" onClick={startRecording} disabled={phase !== 'idle'}><Play size={18} /> Add {RECORD_SECONDS}-second sample</button>}
          </div>
          <div className="ai-selected-progress"><span>{selectedCount} / {sampleGoal} suggested real samples</span><div><i style={{ width: `${Math.min(100, selectedCount / Math.max(1, sampleGoal) * 100)}%` }} /></div></div>
        </aside>
      </section>

      {showCreate && (
        <section className="ai-new-exercise panel">
          <div className="ai-summary-heading"><Plus size={19} /><div><small>EXTEND THE EXERCISE LIBRARY</small><h2>Create a trainable exercise class</h2></div></div>
          <p>New exercises start as <strong>Draft</strong>. They have no synthetic class yet, so collect real samples from several people, retrain the model, move them to Beta, then Publish when ready.</p>
          <div className="ai-new-exercise-grid">
            <label><span>Name</span><input value={newExercise.name} onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })} placeholder="Barbell row" /></label>
            <label><span>Category</span><input value={newExercise.category} onChange={(e) => setNewExercise({ ...newExercise, category: e.target.value })} /></label>
            <label><span>Difficulty</span><select value={newExercise.difficulty} onChange={(e) => setNewExercise({ ...newExercise, difficulty: e.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
            <label><span>Equipment</span><input value={newExercise.equipment} onChange={(e) => setNewExercise({ ...newExercise, equipment: e.target.value })} /></label>
            <label><span>Target / muscles</span><input value={newExercise.target} onChange={(e) => setNewExercise({ ...newExercise, target: e.target.value })} placeholder="Upper back and biceps" /></label>
            <label><span>Primary muscles</span><input value={newExercise.primaryMuscles} onChange={(e) => setNewExercise({ ...newExercise, primaryMuscles: e.target.value })} placeholder="Lats, Rhomboids" /></label>
            <label><span>Tracking mode</span><select value={newExercise.trackingMode} onChange={(e) => setNewExercise({ ...newExercise, trackingMode: e.target.value })}><option value="classifier-only">AI classification only</option><option value="reps">Repetitions</option><option value="hold">Timed hold</option></select></label>
            <label><span>Geometry template</span><select value={newExercise.trackerTemplate} onChange={(e) => setNewExercise({ ...newExercise, trackerTemplate: e.target.value })}><option value="classifier-only">No existing template</option>{EXERCISE_AI_LABELS.filter((x) => x !== 'unknown').map((x) => <option key={x} value={x}>{prettyLabel(x)}</option>)}</select></label>
            <label><span>Base target</span><input type="number" min="1" value={newExercise.baseTarget} onChange={(e) => setNewExercise({ ...newExercise, baseTarget: Number(e.target.value) })} /></label>
            <label><span>Sets</span><input type="number" min="1" max="10" value={newExercise.sets} onChange={(e) => setNewExercise({ ...newExercise, sets: Number(e.target.value) })} /></label>
            <label><span>Real-sample goal</span><input type="number" min="8" value={newExercise.sampleGoal} onChange={(e) => setNewExercise({ ...newExercise, sampleGoal: Number(e.target.value) })} /></label>
            <label className="wide"><span>YouTube demo URL (optional)</span><input value={newExercise.youtubeUrl} onChange={(e) => setNewExercise({ ...newExercise, youtubeUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></label>
            <label className="wide"><span>Description / how it works</span><textarea value={newExercise.description} onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })} placeholder="Describe the movement and what a correct rep looks like." /></label>
            <label className="wide"><span>Instructions — one per line</span><textarea value={newExercise.instructions} onChange={(e) => setNewExercise({ ...newExercise, instructions: e.target.value })} /></label>
            <label className="wide"><span>Common mistakes — one per line</span><textarea value={newExercise.commonMistakes} onChange={(e) => setNewExercise({ ...newExercise, commonMistakes: e.target.value })} /></label>
          </div>
          <button className="button" onClick={createExercise}><Save size={17} /> Create Draft Exercise</button>
        </section>
      )}

      <section className="ai-exercise-registry">
        <div className="ai-summary-heading"><Dumbbell size={19} /><div><small>EXERCISE REGISTRY</small><h2>Draft → Beta → Published</h2></div></div>
        <div className="ai-registry-grid">
          {(exerciseCatalog.custom || []).map((exercise) => (
            <article key={exercise.id} className="ai-registry-card">
              <div><span className={`ai-status-badge ${exercise.status}`}>{exercise.status}</span><h3>{exercise.name}</h3><p>{exercise.description || 'Custom admin-created movement class.'}</p></div>
              <div className="ai-registry-stats"><span>{exercise.realSampleCount || 0} real · {exercise.approvedSampleCount || 0} approved</span><span>{exercise.needsRetrain ? 'New approved data · retrain recommended' : exercise.aiReady ? 'Included in the trained AI model' : 'Not trained yet'}</span></div>
              <div className="ai-registry-actions">
                <button onClick={() => setExerciseStatus(exercise, 'draft')}>Draft</button>
                <button onClick={() => setExerciseStatus(exercise, 'beta')}>Beta</button>
                <button onClick={() => setExerciseStatus(exercise, 'published')}>Publish</button>
                <button className="danger" onClick={() => removeExercise(exercise)}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
          {!(exerciseCatalog.custom || []).length && <div className="ai-manager-empty">No custom exercises yet. Create one above when you want to extend ScanRig.</div>}
        </div>
      </section>

      <section className="ai-model-deployment">
        <div className="ai-summary-heading"><BrainCircuit size={19} /><div><small>ACTIVE BROWSER MODEL</small><h2>ONNX deployment status</h2></div></div>
        <div className="ai-model-deployment-grid">
          <article><small>STATUS</small><strong className={effectiveModelStatus.installed ? 'ready' : ''}>{effectiveModelStatus.installed ? 'ONNX ACTIVE' : 'MODEL MISSING'}</strong><span>{classifier.status === 'ready' ? 'Browser runtime connected' : classifier.status === 'loading' ? 'Loading browser runtime…' : 'Rule fallback active'}</span></article>
          <article><small>MODEL VERSION</small><strong>{effectiveModelStatus.modelVersion ? String(effectiveModelStatus.modelVersion).slice(0, 12) : '—'}</strong><span>{effectiveModelStatus.exportedAt ? formatTime(effectiveModelStatus.exportedAt) : (classifier.status === 'ready' ? 'Browser model loaded' : 'Train once to create a version')}</span></article>
          <article><small>TRAINED CLASSES</small><strong>{effectiveModelStatus.classCount || 0}</strong><span>{(effectiveModelStatus.labels || []).slice(0, 3).map((label) => prettyLabel(label, names)).join(' · ') || 'No labels yet'}{(effectiveModelStatus.classCount || 0) > 3 ? ' …' : ''}</span></article>
          <article><small>MODEL TEST</small><strong>{Number.isFinite(Number(effectiveModelStatus.testAccuracy)) ? `${Math.round(Number(effectiveModelStatus.testAccuracy) * 1000) / 10}%` : '—'}</strong><span>{effectiveModelStatus.splitMode ? String(effectiveModelStatus.splitMode).replaceAll('-', ' ') : 'No evaluation metadata'}</span></article>
          <article><small>TRAINING DATA</small><strong>{effectiveModelStatus.datasetSamples ?? '—'}</strong><span>{Object.entries(effectiveModelStatus.sourceCounts || {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'Legacy model metadata'}</span></article>
          <article><small>EXPORT PARITY</small><strong>{effectiveModelStatus.maxParityDifference !== null && effectiveModelStatus.maxParityDifference !== undefined ? Number(effectiveModelStatus.maxParityDifference).toExponential(1) : '—'}</strong><span>Keras ↔ ONNX max difference</span></article>
        </div>
      </section>

      <section className="ai-training-runner">
        <div className="ai-summary-heading"><BrainCircuit size={19} /><div><small>PROGRESSIVE MODEL TRAINER</small><h2>Synthetic base + real samples + new classes</h2></div></div>
        <div className="ai-training-runner-grid"><div><span className={`ai-training-state ${trainingJob.stage || 'idle'}`}>{trainingJob.running ? 'TRAINING' : String(trainingJob.stage || 'idle').replaceAll('-', ' ').toUpperCase()}</span><p>Existing classes use the synthetic base plus real samples. Admin-created classes have no synthetic samples, so they enter training from the approved real examples you collect here.</p><button className="button" onClick={retrainModel} disabled={trainingJob.running}><BrainCircuit size={17} /> {trainingJob.running ? 'Training in progress…' : 'Retrain ScanRig AI'}</button></div><pre className="ai-training-log">{(trainingJob.logs || []).slice(-12).join('\n') || 'No training run yet.'}</pre></div>
      </section>

      <section className="ai-sample-manager">
        <div className="ai-summary-heading"><Database size={19} /><div><small>REAL SAMPLE MANAGER</small><h2>Who taught what?</h2></div></div>
        <div className="ai-manager-toolbar"><label>Filter <select value={filterLabel} onChange={(e) => setFilterLabel(e.target.value)}><option value="all">All exercises</option>{labels.map((label) => <option key={label} value={label}>{prettyLabel(label, names)}</option>)}</select></label><span>{sampleTotal} matching samples</span><button onClick={exportDataset}><Download size={15} /> Export</button><button onClick={refresh}><RefreshCw size={15} /> Refresh</button></div>
        <div className="ai-sample-list">
          {loadingData && <div className="ai-manager-empty">Loading real samples…</div>}
          {!loadingData && !samples.length && <div className="ai-manager-empty">No matching samples yet.</div>}
          {samples.map((sample) => (
            <article className="ai-sample-row" key={sample.id}>
              <div className="ai-sample-main"><strong>{prettyLabel(sample.label, names)}</strong><span>{sample.participantName || sample.participantId} · {sample.participantGender} · {sample.trainerPersona === 'jody' ? 'Jody' : 'James'} · {sample.cameraView} · {formatTime(sample.capturedAt)}</span></div>
              <select value={sample.label} onChange={(e) => changeSample(sample, { label: e.target.value })}>{labels.map((label) => <option key={label} value={label}>{prettyLabel(label, names)}</option>)}</select>
              <select value={sample.status} onChange={(e) => changeSample(sample, { status: e.target.value })}><option value="approved">Approved</option><option value="review">Review</option><option value="rejected">Rejected</option></select>
              <button className="icon-button danger" onClick={() => removeSample(sample)}><Trash2 size={16} /></button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
