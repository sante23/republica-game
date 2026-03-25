// Synthesized game sounds using Web Audio API - no external files needed

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not available
  }
}

const SOUNDS: Record<string, () => void> = {
  build: () => {
    playTone(440, 0.1, 'square', 0.1);
    setTimeout(() => playTone(554, 0.1, 'square', 0.1), 100);
    setTimeout(() => playTone(659, 0.15, 'square', 0.1), 200);
  },
  train: () => {
    playTone(330, 0.15, 'sawtooth', 0.08);
    setTimeout(() => playTone(440, 0.15, 'sawtooth', 0.08), 150);
  },
  trade: () => {
    playTone(523, 0.1, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.12), 80);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.12), 160);
  },
  battle_win: () => {
    playTone(523, 0.15, 'square', 0.1);
    setTimeout(() => playTone(659, 0.15, 'square', 0.1), 150);
    setTimeout(() => playTone(784, 0.15, 'square', 0.1), 300);
    setTimeout(() => playTone(1047, 0.3, 'square', 0.1), 450);
  },
  battle_lose: () => {
    playTone(440, 0.2, 'sawtooth', 0.1);
    setTimeout(() => playTone(370, 0.2, 'sawtooth', 0.1), 200);
    setTimeout(() => playTone(294, 0.4, 'sawtooth', 0.1), 400);
  },
  achievement: () => {
    playTone(523, 0.1, 'sine', 0.15);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.15), 100);
    setTimeout(() => playTone(784, 0.1, 'sine', 0.15), 200);
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.15), 300);
    setTimeout(() => playTone(1047, 0.3, 'triangle', 0.1), 350);
  },
  notification: () => {
    playTone(880, 0.08, 'sine', 0.1);
    setTimeout(() => playTone(1100, 0.12, 'sine', 0.1), 80);
  },
  click: () => {
    playTone(600, 0.05, 'square', 0.05);
  },
  error: () => {
    playTone(200, 0.15, 'sawtooth', 0.1);
    setTimeout(() => playTone(180, 0.25, 'sawtooth', 0.1), 150);
  },
  research: () => {
    playTone(440, 0.15, 'triangle', 0.1);
    setTimeout(() => playTone(554, 0.15, 'triangle', 0.1), 150);
    setTimeout(() => playTone(659, 0.15, 'triangle', 0.1), 300);
    setTimeout(() => playTone(880, 0.25, 'triangle', 0.12), 450);
  }
};

export function playSound(name: string) {
  const fn = SOUNDS[name];
  if (fn) fn();
}
