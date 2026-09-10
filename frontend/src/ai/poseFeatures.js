export const POSE_LANDMARK_COUNT = 33;
export const FEATURES_PER_LANDMARK = 4;
export const POSE_FEATURE_COUNT = POSE_LANDMARK_COUNT * FEATURES_PER_LANDMARK;
export const DEFAULT_SEQUENCE_LENGTH = 48;
export const DEFAULT_SAMPLE_HZ = 12;

const L = {
  LSH: 11,
  RSH: 12,
  LHIP: 23,
  RHIP: 24,
};

function midpoint(a, b) {
  return {
    x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2,
    y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2,
    z: ((a?.z ?? 0) + (b?.z ?? 0)) / 2,
  };
}

function dist2d(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Converts MediaPipe's 33 landmarks into a translation/scale-normalized vector.
 * The hip midpoint becomes the origin. Torso length is the preferred scale;
 * shoulder width is the fallback. Visibility is kept as the fourth channel.
 */
export function normalizePoseLandmarks(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < POSE_LANDMARK_COUNT) return null;

  const hipMid = midpoint(landmarks[L.LHIP], landmarks[L.RHIP]);
  const shoulderMid = midpoint(landmarks[L.LSH], landmarks[L.RSH]);
  const torso = dist2d(hipMid, shoulderMid);
  const shoulders = dist2d(landmarks[L.LSH], landmarks[L.RSH]);
  const scale = Math.max(torso, shoulders, 0.08);

  const features = [];
  for (let index = 0; index < POSE_LANDMARK_COUNT; index += 1) {
    const point = landmarks[index] || {};
    features.push(
      finite((point.x - hipMid.x) / scale),
      finite((point.y - hipMid.y) / scale),
      finite(((point.z ?? 0) - hipMid.z) / scale),
      Math.max(0, Math.min(1, finite(point.visibility ?? point.presence ?? 1, 1))),
    );
  }
  return features;
}

export function isFeatureFrame(frame) {
  return Array.isArray(frame) && frame.length === POSE_FEATURE_COUNT && frame.every(Number.isFinite);
}

/** Uniformly resamples a variable-length recording to the model sequence length. */
export function resampleSequence(frames, targetLength = DEFAULT_SEQUENCE_LENGTH) {
  const valid = (frames || []).filter(isFeatureFrame);
  if (!valid.length) return null;
  if (valid.length === targetLength) return valid.map((frame) => [...frame]);
  if (valid.length === 1) return Array.from({ length: targetLength }, () => [...valid[0]]);

  return Array.from({ length: targetLength }, (_, outputIndex) => {
    const sourcePosition = (outputIndex / Math.max(1, targetLength - 1)) * (valid.length - 1);
    const low = Math.floor(sourcePosition);
    const high = Math.min(valid.length - 1, Math.ceil(sourcePosition));
    const ratio = sourcePosition - low;
    return valid[low].map((value, featureIndex) => (
      value * (1 - ratio) + valid[high][featureIndex] * ratio
    ));
  });
}

export function createRecording({ label, frames, notes = '', sessionId = '', participantId = '', participantName = '', participantGender = 'other', trainerPersona = 'james', cameraView = 'front' }) {
  const sequence = resampleSequence(frames, DEFAULT_SEQUENCE_LENGTH);
  if (!sequence) return null;
  return {
    schemaVersion: 1,
    recordingId: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: sessionId || `session-${new Date().toISOString().slice(0, 10)}`,
    label,
    participantId: participantName || participantId || 'Unknown trainer',
    participantName: participantName || participantId || 'Unknown trainer',
    participantGender,
    trainerPersona,
    cameraView,
    notes,
    capturedAt: new Date().toISOString(),
    sequenceLength: DEFAULT_SEQUENCE_LENGTH,
    featureCount: POSE_FEATURE_COUNT,
    sampleHz: DEFAULT_SAMPLE_HZ,
    frames: sequence,
  };
}
