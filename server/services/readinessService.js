export function normaliseReadinessInput(input = {}) {
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  return {
    energy: clamp(input.energy, 1, 5, 3),
    sleep: clamp(input.sleep, 1, 5, 3),
    soreness: clamp(input.soreness, 1, 5, 3),
    stress: clamp(input.stress, 1, 5, 3),
    discomfort: clamp(input.discomfort, 0, 5, 0),
    note: String(input.note || '').trim().slice(0, 280),
  };
}

export function scoreReadiness(input = {}) {
  const value = normaliseReadinessInput(input);
  const positive = ((value.energy - 1) / 4) * 30 + ((value.sleep - 1) / 4) * 30;
  const recovery = ((5 - value.soreness) / 4) * 22 + ((5 - value.stress) / 4) * 18;
  let score = Math.round(positive + recovery);
  if (value.discomfort >= 4) score = Math.min(score, 25);
  else if (value.discomfort >= 2) score = Math.min(score, 48);
  score = Math.max(0, Math.min(100, score));

  const band = score >= 72 ? 'ready' : score >= 48 ? 'moderate' : 'recovery';
  const adjustments = band === 'ready'
    ? { volumeMultiplier: 1.04, restBonusSeconds: 0, sessionMode: 'normal' }
    : band === 'moderate'
      ? { volumeMultiplier: 0.9, restBonusSeconds: 10, sessionMode: 'controlled' }
      : { volumeMultiplier: 0.72, restBonusSeconds: 20, sessionMode: 'recovery' };

  const message = band === 'ready'
    ? 'You look ready for a normal session. Keep the targets comfortable and prioritize clean reps.'
    : band === 'moderate'
      ? 'Use controlled volume today and allow a little more recovery between sets.'
      : 'Keep today light. ScanRig will reduce volume and lengthen rest; stop the session if movement feels painful or unsafe.';

  return { ...value, score, band, adjustments, message };
}
