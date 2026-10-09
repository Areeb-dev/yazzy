import type { ReactionKind } from '@game/types/reactions';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  {
    type = 'sine',
    freq,
    endFreq,
    start,
    dur,
    gain = 0.18,
    endGain = 0.0001,
  }: {
    type?: OscillatorType;
    freq: number;
    endFreq?: number;
    start: number;
    dur: number;
    gain?: number;
    endGain?: number;
  },
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + dur);
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(endGain, start + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noiseBurst(ac: AudioContext, start: number, dur: number, gain = 0.12) {
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  const g = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  src.buffer = buf;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** Soft bubble / pop when an emoji reaction appears. */
export function playEmojiSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, { type: 'sine', freq: 620, endFreq: 980, start: t, dur: 0.09, gain: 0.14 });
  tone(ac, { type: 'triangle', freq: 980, endFreq: 520, start: t + 0.05, dur: 0.14, gain: 0.1 });
}

/** Whoosh as a throwable leaves the sender. */
export function playThrowSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  noiseBurst(ac, t, 0.22, 0.1);
  tone(ac, { type: 'sawtooth', freq: 420, endFreq: 140, start: t, dur: 0.28, gain: 0.06 });
}

/** Impact / splat when a throwable hits the target. */
export function playImpactSound(reactionId: string) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  if (reactionId === 'donkey') {
    tone(ac, { type: 'square', freq: 180, endFreq: 90, start: t, dur: 0.12, gain: 0.1 });
    tone(ac, { type: 'triangle', freq: 320, endFreq: 140, start: t + 0.05, dur: 0.18, gain: 0.08 });
    noiseBurst(ac, t, 0.16, 0.08);
    return;
  }
  if (reactionId === 'water') {
    noiseBurst(ac, t, 0.2, 0.12);
    tone(ac, { type: 'sine', freq: 540, endFreq: 220, start: t, dur: 0.18, gain: 0.08 });
    return;
  }
  if (reactionId === 'glove') {
    tone(ac, { type: 'square', freq: 120, endFreq: 60, start: t, dur: 0.1, gain: 0.14 });
    noiseBurst(ac, t, 0.08, 0.14);
    return;
  }
  tone(ac, { type: 'triangle', freq: 160, endFreq: 70, start: t, dur: 0.14, gain: 0.12 });
  noiseBurst(ac, t, 0.14, 0.11);
}

export function playReactionStart(kind: ReactionKind) {
  if (kind === 'emoji') playEmojiSound();
  else playThrowSound();
}
