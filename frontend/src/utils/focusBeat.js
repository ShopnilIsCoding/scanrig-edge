let audioContext = null;
let timer = null;

function tick() {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine'; osc.frequency.value = 118;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(); osc.stop(audioContext.currentTime + 0.13);
}

export async function startFocusBeat() {
  if (timer) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioContext = audioContext || new Ctx();
  if (audioContext.state === 'suspended') await audioContext.resume();
  tick(); timer = window.setInterval(tick, 760);
}

export function stopFocusBeat() {
  if (timer) window.clearInterval(timer);
  timer = null;
}
