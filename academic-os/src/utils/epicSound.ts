/** Sonido épico sintetizado — sin archivos externos */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, start: number, duration: number, volume = 0.12, type: OscillatorType = 'sine') {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

export async function playVictoryFanfare(): Promise<void> {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const chords = [
      [220, 277, 330],
      [175, 220, 262],
      [262, 330, 392],
      [196, 247, 294],
    ];
    chords.forEach((notes, i) => {
      notes.forEach((f) => playTone(f, i * 0.22, 0.5, 0.08, 'triangle'));
    });
    playTone(440, 0.9, 0.6, 0.15, 'sine');
    playTone(554, 1.0, 0.5, 0.12, 'sine');
    playTone(659, 1.1, 0.8, 0.1, 'triangle');
  } catch {
    /* audio bloqueado */
  }
}

export async function playBlockEndChime(): Promise<void> {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    playTone(392, 0, 0.35, 0.14, 'sine');
    playTone(523, 0.12, 0.28, 0.12, 'triangle');
    playTone(440, 0.28, 0.4, 0.1, 'sine');
  } catch {
    /* audio bloqueado hasta interacción del usuario */
  }
}

export async function playBlockCompleteChime(): Promise<void> {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    playTone(880, 0, 0.12, 0.14, 'sine');
    playTone(1175, 0.1, 0.15, 0.12, 'triangle');
    playTone(988, 0.22, 0.25, 0.1, 'sine');
  } catch {
    /* audio bloqueado hasta interacción del usuario */
  }
}

export async function playXpGainChime(): Promise<void> {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    playTone(660, 0, 0.1, 0.11, 'triangle');
    playTone(880, 0.08, 0.14, 0.13, 'sine');
    playTone(1100, 0.18, 0.2, 0.1, 'triangle');
  } catch {
    /* ignore */
  }
}

export async function playNightBonusChime(): Promise<void> {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    playTone(523, 0, 0.3, 0.1);
    playTone(659, 0.15, 0.3, 0.08);
    playTone(784, 0.3, 0.5, 0.1);
  } catch {
    /* ignore */
  }
}
