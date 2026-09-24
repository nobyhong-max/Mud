export class Sfx {
  constructor() {
    this.ctx = null;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  tone(freq, dur, type = 'square', gain = 0.04, slide = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  shoot() { this.tone(170, 0.06, 'sawtooth', 0.045, -70); }
  hit() { this.tone(520, 0.05, 'triangle', 0.045); }
  head() { this.tone(880, 0.08, 'square', 0.055, 180); }
  reload() { this.tone(220, 0.07, 'triangle', 0.03); setTimeout(() => this.tone(320, 0.09, 'triangle', 0.03), 160); }
  step() { this.tone(60 + Math.random() * 25, 0.035, 'sine', 0.015); }
  ability() { this.tone(280, 0.12, 'sine', 0.05, 100); }
  plant() { this.tone(200, 0.12, 'square', 0.04); setTimeout(() => this.tone(260, 0.12, 'square', 0.04), 150); }
  explode() { this.tone(80, 0.4, 'sawtooth', 0.07, -40); }
  win() { this.tone(440, 0.12, 'triangle', 0.05); setTimeout(() => this.tone(554, 0.14, 'triangle', 0.05), 100); setTimeout(() => this.tone(659, 0.2, 'triangle', 0.05), 200); }
  lose() { this.tone(280, 0.25, 'sawtooth', 0.04, -100); }
  buy() { this.tone(480, 0.06, 'sine', 0.035); }
  death() { this.tone(110, 0.3, 'sawtooth', 0.05, -60); }
}
