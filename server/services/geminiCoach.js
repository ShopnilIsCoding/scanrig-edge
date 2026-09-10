export async function addGeminiCoachNote(plan, user, options = {}) {
  if (options.localOnly || !process.env.GEMINI_API_KEY) return { ...plan, coachNote: fallbackNote(plan), coachSource: 'scanrig-planner' };
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const prompt = [
      'You are the optional language coach for a home-fitness web application.',
      'The numeric workout plan below has already been created by ScanRig. Do not change exercise names, days, sets, reps, seconds, or duration.',
      'Write 2 short supportive sentences explaining why the plan fits the user. Avoid medical claims, diagnosis, weight-loss promises, or gender stereotypes.',
      `User name: ${user.name}.`,
      `Plan JSON: ${JSON.stringify(plan)}`,
    ].join('\n');
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = String(response.text || '').trim();
    return { ...plan, coachNote: text || fallbackNote(plan), coachSource: text ? `gemini:${model}` : 'scanrig-planner' };
  } catch (error) {
    console.warn('[ScanRig] Gemini coach unavailable; using deterministic note.', error.message);
    return { ...plan, coachNote: fallbackNote(plan), coachSource: 'scanrig-planner' };
  }
}

function fallbackNote(plan) {
  const p = plan.profile || {};
  const form = plan.recentPerformance?.averageForm;
  const readiness = plan.readiness;
  if (readiness?.band === 'recovery') return `Your weekly structure stays the same, but today’s session is deliberately lighter with more recovery because your readiness check-in was ${readiness.score}/100.`;
  if (readiness?.band === 'moderate') return `Your selected training day stays in place, while today’s targets are slightly controlled and rest is longer because your readiness check-in was ${readiness.score}/100.`;
  if (readiness?.band === 'ready') return `Your selected training day stays unchanged, and today’s ${readiness.score}/100 readiness supports the normal planned volume while form quality remains the priority.`;
  if (form >= 90) return `Your ${p.selectedDays?.length || 0}-day plan keeps the structure you chose and adds a little volume because your recent form has been strong.`;
  if (form > 0 && form < 78) return `Your selected days stay unchanged, while the current targets remain controlled so you can focus on cleaner movement before increasing volume.`;
  return `Your plan follows the days, goal, level, and session length you selected. ScanRig will adjust future targets as your real workout history grows.`;
}
