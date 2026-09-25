/** WebAudio synthesized SFX — no external files needed */

let ctx = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Unlock audio on first user gesture */
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
}

function tone(freq, dur, type = "square", gain = 0.08, slide = 0) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, gain = 0.1, filterFreq = 1200) {
  const c = ensureCtx();
  if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const SFX = {
  shoot() {
    noiseBurst(0.06, 0.12, 1800);
    tone(220, 0.05, "square", 0.04, -120);
  },
  hit() {
    tone(180, 0.08, "sawtooth", 0.07, -80);
    noiseBurst(0.05, 0.06, 800);
  },
  reload() {
    tone(320, 0.07, "triangle", 0.05);
    setTimeout(() => tone(240, 0.09, "triangle", 0.05), 90);
  },
  flash() {
    tone(880, 0.12, "sine", 0.09, 400);
    noiseBurst(0.2, 0.1, 2400);
  },
  smoke() {
    noiseBurst(0.35, 0.09, 400);
    tone(90, 0.25, "sine", 0.05, -30);
  },
  dash() {
    tone(150, 0.18, "sawtooth", 0.07, 500);
    noiseBurst(0.12, 0.05, 900);
  },
  ui() {
    tone(520, 0.04, "sine", 0.04);
  },
  ready() {
    tone(660, 0.06, "sine", 0.05);
    setTimeout(() => tone(880, 0.07, "sine", 0.05), 60);
  },
};
