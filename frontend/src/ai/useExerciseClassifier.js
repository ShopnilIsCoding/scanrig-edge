import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SAMPLE_HZ, DEFAULT_SEQUENCE_LENGTH, normalizePoseLandmarks, resampleSequence } from './poseFeatures';
import { EXERCISE_AI_LABELS, EXERCISE_AI_NAMES } from './exerciseLabels';

const MODEL_BASE = (import.meta.env.VITE_AI_MODEL_URL || '/ai-model').replace(/\/$/, '');
const LABELS_URL = `${MODEL_BASE}/labels.json`;
const META_URL = `${MODEL_BASE}/model_meta.json`;
const RUNTIME_URL = `${MODEL_BASE}/runtime.json`;

function averageVectors(vectors) {
  if (!vectors.length) return [];
  return vectors[0].map((_, index) => vectors.reduce((sum, vector) => sum + (vector[index] || 0), 0) / vectors.length);
}

function choosePrediction(probabilities, labels, threshold, margin) {
  const ranked = probabilities
    .map((confidence, index) => ({ label: labels[index] || `class-${index}`, confidence }))
    .sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0] || { label: 'unknown', confidence: 0 };
  const second = ranked[1] || { confidence: 0 };
  const uncertain = top.confidence < threshold || top.confidence - second.confidence < margin;
  if (uncertain) {
    return {
      label: 'unknown',
      displayName: EXERCISE_AI_NAMES.unknown,
      confidence: top.confidence,
      rawLabel: top.label,
      rawConfidence: top.confidence,
      probabilities: ranked,
    };
  }
  return {
    label: top.label,
    displayName: EXERCISE_AI_NAMES[top.label] || top.label,
    confidence: top.confidence,
    rawLabel: top.label,
    rawConfidence: top.confidence,
    probabilities: ranked,
  };
}

export default function useExerciseClassifier({ enabled = true } = {}) {
  const ortRef = useRef(null);
  const sessionRef = useRef(null);
  const inputNameRef = useRef('pose_sequence');
  const outputNameRef = useRef('exercise_probability');
  const labelsRef = useRef(EXERCISE_AI_LABELS);
  const metaRef = useRef({ sequenceLength: DEFAULT_SEQUENCE_LENGTH, sampleHz: DEFAULT_SAMPLE_HZ, threshold: 0.72, margin: 0.12, featureCount: 132 });
  const bufferRef = useRef([]);
  const lastSampleAtRef = useRef(0);
  const sincePredictionRef = useRef(0);
  const predictingRef = useRef(false);
  const probabilityHistoryRef = useRef([]);
  const [status, setStatus] = useState(enabled ? 'loading' : 'disabled');
  const [prediction, setPrediction] = useState({ label: 'unknown', displayName: 'Waiting for movement', confidence: 0, probabilities: [] });
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [modelInfo, setModelInfo] = useState({ version: null, exportedAt: null, classCount: 0, testAccuracy: null, splitMode: null });

  const reloadModel = useCallback(async () => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      return undefined;
    }
    let cancelled = false;

    const load = async () => {
      try {
        setStatus('loading');
        setError('');

        // Load the manifest first. Stage 21 adds a content-derived modelVersion,
        // so every retrain gets a unique model URL and can hot-reload safely.
        const runtimeResponse = await fetch(`${RUNTIME_URL}?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
        if (!runtimeResponse?.ok) {
          setStatus('missing');
          setError('Custom model has not been exported yet. MediaPipe + rule validation remains active.');
          return;
        }
        const runtime = await runtimeResponse.json();
        const version = runtime.modelVersion || runtime.exportedAt || String(Date.now());
        const modelUrl = `${MODEL_BASE}/model.onnx?v=${encodeURIComponent(version)}`;

        const probe = await fetch(modelUrl, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
        if (!probe?.ok) {
          setStatus('missing');
          setError('The ONNX manifest exists, but model.onnx could not be loaded from the ScanRig server.');
          return;
        }

        const [ort, labelsResponse, metaResponse] = await Promise.all([
          import('onnxruntime-web'),
          fetch(`${LABELS_URL}?v=${encodeURIComponent(version)}`, { cache: 'no-store' }).catch(() => null),
          fetch(`${META_URL}?v=${encodeURIComponent(version)}`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (cancelled) return;
        ortRef.current = ort;

        let metaPayload = {};
        if (labelsResponse?.ok) {
          const labelsPayload = await labelsResponse.json();
          labelsRef.current = Array.isArray(labelsPayload) ? labelsPayload : labelsPayload.labels || EXERCISE_AI_LABELS;
        }
        if (metaResponse?.ok) {
          metaPayload = await metaResponse.json();
          metaRef.current = { ...metaRef.current, ...metaPayload };
        }
        inputNameRef.current = runtime.inputName || inputNameRef.current;
        outputNameRef.current = runtime.outputName || outputNameRef.current;

        try { await sessionRef.current?.release?.(); } catch { /* no-op */ }
        sessionRef.current = null;

        // WASM is the broadest browser backend and is fast enough for this small
        // temporal pose model. The URL is versioned so retraining never reuses a stale model.
        sessionRef.current = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        if (cancelled) return;

        inputNameRef.current = sessionRef.current.inputNames?.[0] || inputNameRef.current;
        outputNameRef.current = sessionRef.current.outputNames?.[0] || outputNameRef.current;

        const sequenceLength = Number(metaRef.current.sequenceLength || DEFAULT_SEQUENCE_LENGTH);
        const featureCount = Number(metaRef.current.featureCount || 132);
        const warmup = new ort.Tensor('float32', new Float32Array(sequenceLength * featureCount), [1, sequenceLength, featureCount]);
        await sessionRef.current.run({ [inputNameRef.current]: warmup });
        if (cancelled) return;

        setModelInfo({
          version,
          exportedAt: runtime.exportedAt || null,
          classCount: labelsRef.current.length,
          testAccuracy: metaPayload.testAccuracy ?? null,
          splitMode: metaPayload.splitMode || null,
          datasetSamples: metaPayload.datasetSamples ?? null,
          sourceCounts: metaPayload.sourceCounts || {},
          maxParityDifference: runtime.maxParityDifference ?? null,
        });
        bufferRef.current = [];
        probabilityHistoryRef.current = [];
        sincePredictionRef.current = 0;
        setStatus('ready');
        setError('');
      } catch (loadError) {
        console.warn('[ScanRig AI] ONNX classifier unavailable; using rule fallback.', loadError);
        if (!cancelled) {
          setStatus('missing');
          setError('Custom classifier could not start. Rule-based tracking remains available.');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey]);

  useEffect(() => () => {
    try { sessionRef.current?.release?.(); } catch { /* no-op */ }
    sessionRef.current = null;
  }, []);

  const reset = useCallback(() => {
    bufferRef.current = [];
    probabilityHistoryRef.current = [];
    sincePredictionRef.current = 0;
    lastSampleAtRef.current = 0;
    setPrediction({ label: 'unknown', displayName: 'Waiting for movement', confidence: 0, probabilities: [] });
  }, []);

  const predictBuffer = useCallback(async () => {
    const ort = ortRef.current;
    const session = sessionRef.current;
    if (!ort || !session || predictingRef.current) return;
    const meta = metaRef.current;
    const sequenceLength = Number(meta.sequenceLength || DEFAULT_SEQUENCE_LENGTH);
    const featureCount = Number(meta.featureCount || 132);
    const sequence = resampleSequence(bufferRef.current, sequenceLength);
    if (!sequence) return;

    predictingRef.current = true;
    try {
      const flat = new Float32Array(sequenceLength * featureCount);
      let cursor = 0;
      for (const frame of sequence) {
        for (let i = 0; i < featureCount; i += 1) flat[cursor++] = Number(frame[i] || 0);
      }

      const input = new ort.Tensor('float32', flat, [1, sequenceLength, featureCount]);
      const outputs = await session.run({ [inputNameRef.current]: input });
      const outputTensor = outputs[outputNameRef.current] || outputs[session.outputNames?.[0]] || Object.values(outputs)[0];
      if (!outputTensor?.data) throw new Error('ONNX model returned no probability tensor.');
      const probabilities = Array.from(outputTensor.data, Number);

      probabilityHistoryRef.current = [...probabilityHistoryRef.current.slice(-3), probabilities];
      const smoothed = averageVectors(probabilityHistoryRef.current);
      setPrediction(choosePrediction(
        smoothed,
        labelsRef.current,
        Number(meta.threshold ?? 0.72),
        Number(meta.margin ?? 0.12),
      ));
    } catch (predictError) {
      console.warn('[ScanRig AI] ONNX inference failed.', predictError);
      setError('Custom classifier paused after an inference error.');
    } finally {
      predictingRef.current = false;
    }
  }, []);

  const pushLandmarks = useCallback((landmarks, timestamp = performance.now()) => {
    if (status !== 'ready') return;
    const featureFrame = normalizePoseLandmarks(landmarks);
    if (!featureFrame) return;
    const sampleEveryMs = 1000 / Number(metaRef.current.sampleHz || DEFAULT_SAMPLE_HZ);
    if (timestamp - lastSampleAtRef.current < sampleEveryMs) return;
    lastSampleAtRef.current = timestamp;

    const sequenceLength = Number(metaRef.current.sequenceLength || DEFAULT_SEQUENCE_LENGTH);
    bufferRef.current = [...bufferRef.current.slice(-(sequenceLength - 1)), featureFrame];
    sincePredictionRef.current += 1;
    if (bufferRef.current.length >= Math.min(sequenceLength, 24) && sincePredictionRef.current >= 6) {
      sincePredictionRef.current = 0;
      predictBuffer();
    }
  }, [predictBuffer, status]);

  return {
    status,
    prediction,
    error,
    pushLandmarks,
    reset,
    reloadModel,
    modelReady: status === 'ready',
    modelInfo,
    labels: labelsRef.current,
    meta: metaRef.current,
  };
}
