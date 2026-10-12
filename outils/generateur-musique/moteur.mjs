/**
 * Moteur de synthèse hors temps réel : oscillateurs, filtres, enveloppes,
 * sons de batterie, effets (réverbération, écho) et mixage final.
 * Tout est calculé échantillon par échantillon en Float32, à 44,1 kHz.
 */
export const SR = 44100;

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même morceau. */
export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
  };
}

export const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** Filtre à variables d'état (topologie TPT de Zavalishin), stable même très résonant. */
export class Svf {
  constructor(cutoff = 1000, q = 0.707) {
    this.ic1 = 0;
    this.ic2 = 0;
    this.low = 0;
    this.band = 0;
    this.high = 0;
    this.set(cutoff, q);
  }

  set(cutoff, q) {
    const frequency = Math.min(Math.max(cutoff, 20), SR * 0.45);
    const g = Math.tan((Math.PI * frequency) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  process(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
    this.high = x - this.k * v1 - v2;
    return v2;
  }
}

/** Correction PolyBLEP : supprime l'essentiel du repliement des formes d'onde à angles vifs. */
function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

function oscillator(wave, phase, dt) {
  switch (wave) {
    case 'saw':
      return 2 * phase - 1 - polyBlep(phase, dt);
    case 'square': {
      let value = phase < 0.5 ? 1 : -1;
      value += polyBlep(phase, dt);
      value -= polyBlep((phase + 0.5) % 1, dt);
      return value;
    }
    case 'tri':
      return 1 - 4 * Math.abs(phase - 0.5);
    default:
      return Math.sin(2 * Math.PI * phase);
  }
}

function envelopeLevel(t, dur, a, d, s) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - ((1 - s) * (t - a)) / d;
  return s;
}

/** Enveloppe ADSR linéaire ; la phase de relâchement part du niveau atteint à la fin de la note. */
function adsr(t, dur, a, d, s, r) {
  if (t < dur) return envelopeLevel(t, dur, a, d, s);
  const level = envelopeLevel(dur, dur, a, d, s);
  return Math.max(0, level * (1 - (t - dur) / r));
}

/**
 * Voix de synthétiseur soustractif : plusieurs oscillateurs désaccordés (supersaw),
 * sous-oscillateur, filtre passe-bas avec enveloppe et LFO, glissando, vibrato, saturation.
 * Retourne { left, right } (identiques si la voix n'est pas stéréo).
 */
export function synth(p) {
  const release = p.r ?? 0.05;
  const length = Math.ceil((p.dur + release) * SR);
  const left = new Float32Array(length);
  const right = p.stereo ? new Float32Array(length) : left;
  const voiceCount = p.voices ?? 1;
  const voices = [];
  for (let index = 0; index < voiceCount; index++) {
    const spread = voiceCount === 1 ? 0 : (index / (voiceCount - 1)) * 2 - 1;
    voices.push({
      ratio: Math.pow(2, (spread * (p.detune ?? 0)) / 1200),
      phase: (index * 0.618) % 1,
      side: voiceCount === 1 || index === (voiceCount - 1) / 2 ? 0 : spread < 0 ? -1 : 1,
    });
  }
  const normalize = 1 / Math.sqrt(voiceCount);
  const filterLeft = new Svf(p.cutoff ?? 20000, p.q ?? 0.707);
  const filterRight = new Svf(p.cutoff ?? 20000, p.q ?? 0.707);
  const a = p.a ?? 0.005;
  const d = p.d ?? 0.1;
  const s = p.s ?? 0.8;
  let subPhase = 0;

  for (let i = 0; i < length; i++) {
    const t = i / SR;
    let frequency = p.freq;
    if (p.glideFrom) {
      const progress = Math.min(1, t / (p.glideTime ?? 0.08));
      frequency = p.glideFrom * Math.pow(p.freq / p.glideFrom, progress);
    }
    if (p.vibrato && t > (p.vibrato.delay ?? 0.15)) {
      frequency *= Math.pow(2, (Math.sin(2 * Math.PI * p.vibrato.rate * t) * p.vibrato.depth) / 1200);
    }

    if ((i & 15) === 0) {
      let cutoff = p.cutoff ?? 20000;
      if (p.filterEnv) cutoff *= Math.pow(2, p.filterEnv * Math.exp(-t / (p.filterDecay ?? 0.1)));
      if (p.lfo) {
        const phase = p.lfo.rate * t + (p.lfo.phase ?? 0);
        const shape = p.lfo.shape === 'saw' ? 1 - (phase % 1) : 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
        cutoff *= Math.pow(2, p.lfo.depth * shape);
      }
      filterLeft.set(cutoff, p.q ?? 0.707);
      if (p.stereo) filterRight.set(cutoff, p.q ?? 0.707);
    }

    let sampleLeft = 0;
    let sampleRight = 0;
    for (const voice of voices) {
      const dt = (frequency * voice.ratio) / SR;
      voice.phase += dt;
      if (voice.phase >= 1) voice.phase -= 1;
      const value = oscillator(p.wave ?? 'saw', voice.phase, dt);
      if (voice.side <= 0) sampleLeft += value;
      if (voice.side >= 0) sampleRight += value;
    }
    sampleLeft *= normalize;
    sampleRight *= normalize;
    if (p.sub) {
      subPhase += frequency / 2 / SR;
      if (subPhase >= 1) subPhase -= 1;
      const sub = Math.sin(2 * Math.PI * subPhase) * p.sub;
      sampleLeft += sub;
      sampleRight += sub;
    }

    const amplitude = adsr(t, p.dur, a, d, s, release) * (p.tremolo ? 1 - p.tremolo.depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * p.tremolo.rate * t)) : 1);
    let outLeft = filterLeft.process(p.stereo ? sampleLeft : (sampleLeft + sampleRight) / 2) * amplitude;
    if (p.drive) outLeft = Math.tanh(outLeft * p.drive) / Math.tanh(p.drive);
    left[i] = outLeft;
    if (p.stereo) {
      let outRight = filterRight.process(sampleRight) * amplitude;
      if (p.drive) outRight = Math.tanh(outRight * p.drive) / Math.tanh(p.drive);
      right[i] = outRight;
    }
  }
  return { left, right };
}

/** Grosse caisse : sinus à chute de hauteur rapide, attaque « click » et saturation. */
export function kick({ start = 150, end = 48, pitchDecay = 0.035, decay = 0.35, click = 0.25, drive = 1.5, rng }) {
  const length = Math.ceil((decay * 2.2 + 0.02) * SR);
  const out = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    const frequency = end + (start - end) * Math.exp(-t / pitchDecay);
    phase += frequency / SR;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t / decay);
    const attack = (rng.next() * 2 - 1) * Math.exp(-t / 0.002) * click;
    out[i] = Math.tanh((body + attack) * drive) / Math.tanh(drive);
  }
  return out;
}

/** Bruit blanc filtré avec enveloppe exponentielle (charleston, shaker, crash). */
export function noiseHit({ decay, type = 'high', cutoff = 7000, q = 0.8, length: seconds, rng }) {
  const length = Math.ceil((seconds ?? decay * 5) * SR);
  const out = new Float32Array(length);
  const filter = new Svf(cutoff, q);
  for (let i = 0; i < length; i++) {
    filter.process(rng.next() * 2 - 1);
    out[i] = (type === 'band' ? filter.band : type === 'low' ? filter.low : filter.high) * Math.exp(-i / SR / decay);
  }
  return out;
}

/** Caisse claire : corps tonal court et bruit filtré. */
export function snare({ tone = 190, decay = 0.16, noise = 0.85, cutoff = 1800, rng }) {
  const length = Math.ceil(decay * 5 * SR);
  const out = new Float32Array(length);
  const filter = new Svf(cutoff, 0.7);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    phase += (tone * (1 + 0.5 * Math.exp(-t / 0.01))) / SR;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.05) * 0.7;
    filter.process(rng.next() * 2 - 1);
    out[i] = body + filter.high * Math.exp(-t / decay) * noise;
  }
  return out;
}

/** Clap : trois rafales de bruit rapprochées puis une queue réverbérée. */
export function clap({ decay = 0.14, cutoff = 1300, rng }) {
  const length = Math.ceil((decay * 5 + 0.03) * SR);
  const out = new Float32Array(length);
  const filter = new Svf(cutoff, 1.2);
  const offsets = [0, 0.011, 0.022];
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    let envelope = 0;
    for (const offset of offsets) if (t >= offset) envelope = Math.max(envelope, Math.exp(-(t - offset) / 0.006));
    if (t >= 0.022) envelope = Math.max(envelope, 0.6 * Math.exp(-(t - 0.022) / decay));
    filter.process(rng.next() * 2 - 1);
    out[i] = filter.band * envelope * 2.2;
  }
  return out;
}

/** Percussion accordée (conga, tom, rimshot) : sinus à légère chute de hauteur. */
export function tonalHit({ freq = 220, drop = 1.3, decay = 0.18, noise = 0.1, rng }) {
  const length = Math.ceil(decay * 5 * SR);
  const out = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    phase += (freq * (1 + (drop - 1) * Math.exp(-t / 0.02))) / SR;
    out[i] = (Math.sin(2 * Math.PI * phase) + (rng.next() * 2 - 1) * noise * Math.exp(-t / 0.01)) * Math.exp(-t / decay);
  }
  return out;
}

/** Montée de bruit (riser) dont le filtre s'ouvre sur toute la durée. */
export function riser({ seconds, rng }) {
  const length = Math.ceil(seconds * SR);
  const out = new Float32Array(length);
  const filter = new Svf(300, 2);
  for (let i = 0; i < length; i++) {
    const progress = i / length;
    if ((i & 31) === 0) filter.set(300 * Math.pow(30, progress), 2);
    filter.process(rng.next() * 2 - 1);
    out[i] = filter.band * progress * progress * 1.4;
  }
  return out;
}

/** Bus stéréo : piste où l'on additionne des sons à des instants donnés. */
class Bus {
  constructor(length) {
    this.left = new Float32Array(length);
    this.right = new Float32Array(length);
  }
}

/** Réverbération de Schroeder/Freeverb simplifiée (4 filtres en peigne + 2 passe-tout par canal). */
function reverb(inputLeft, inputRight, { size = 0.82, damp = 0.3 }) {
  const process = (input, spread) => {
    const out = new Float32Array(input.length);
    const combs = [1557, 1617, 1491, 1422].map((delay) => ({ buffer: new Float32Array(delay + spread), index: 0, store: 0 }));
    const allpasses = [556, 441].map((delay) => ({ buffer: new Float32Array(delay + spread), index: 0 }));
    for (let i = 0; i < input.length; i++) {
      const x = input[i] * 0.015;
      let sum = 0;
      for (const comb of combs) {
        const value = comb.buffer[comb.index];
        comb.store = value * (1 - damp) + comb.store * damp;
        comb.buffer[comb.index] = x + comb.store * size;
        comb.index = (comb.index + 1) % comb.buffer.length;
        sum += value;
      }
      for (const allpass of allpasses) {
        const value = allpass.buffer[allpass.index];
        allpass.buffer[allpass.index] = sum + value * 0.5;
        allpass.index = (allpass.index + 1) % allpass.buffer.length;
        sum = value - sum;
      }
      out[i] = sum;
    }
    return out;
  };
  return { left: process(inputLeft, 0), right: process(inputRight, 23) };
}

/** Écho ping-pong stéréo synchronisé sur le tempo. */
function pingPong(inputLeft, inputRight, { time, feedback = 0.38 }) {
  const delay = Math.round(time * SR);
  const lineLeft = new Float32Array(inputLeft.length);
  const lineRight = new Float32Array(inputLeft.length);
  const left = new Float32Array(inputLeft.length);
  const right = new Float32Array(inputLeft.length);
  for (let i = 0; i < inputLeft.length; i++) {
    const tapLeft = i >= delay ? lineLeft[i - delay] : 0;
    const tapRight = i >= delay ? lineRight[i - delay] : 0;
    // Seules les répétitions sortent : le signal direct reste sur son propre bus.
    lineLeft[i] = (inputLeft[i] + inputRight[i]) * 0.5 + tapRight * feedback;
    lineRight[i] = tapLeft * feedback;
    left[i] = tapLeft;
    right[i] = tapRight;
  }
  return { left, right };
}

/**
 * Morceau en cours de fabrication : bus batterie, bus musique (soumis au
 * sidechain des grosses caisses) et envois vers la réverbération et l'écho.
 */
export class Song {
  constructor(seconds) {
    this.length = Math.ceil(seconds * SR);
    this.drums = new Bus(this.length);
    this.music = new Bus(this.length);
    this.reverbSend = new Bus(this.length);
    this.delaySend = new Bus(this.length);
    this.kickTimes = [];
  }

  /**
   * Ajoute un son (mono Float32Array ou { left, right }) à l'instant `time` (secondes).
   * `pan` va de -1 (gauche) à 1 (droite) ; `reverb` et `delay` dosent les envois.
   */
  add(busName, time, sound, { gain = 1, pan = 0, reverb: reverbAmount = 0, delay = 0 } = {}) {
    const start = Math.round(time * SR);
    if (start >= this.length) return;
    const stereo = !(sound instanceof Float32Array);
    const left = stereo ? sound.left : sound;
    const right = stereo ? sound.right : sound;
    const angle = ((pan + 1) * Math.PI) / 4;
    const gainLeft = gain * (stereo ? 1 : Math.cos(angle) * Math.SQRT2);
    const gainRight = gain * (stereo ? 1 : Math.sin(angle) * Math.SQRT2);
    const bus = this[busName];
    const end = Math.min(this.length, start + left.length);
    for (let i = start; i < end; i++) {
      const valueLeft = left[i - start] * gainLeft;
      const valueRight = right[i - start] * gainRight;
      bus.left[i] += valueLeft;
      bus.right[i] += valueRight;
      if (reverbAmount) {
        this.reverbSend.left[i] += valueLeft * reverbAmount;
        this.reverbSend.right[i] += valueRight * reverbAmount;
      }
      if (delay) {
        this.delaySend.left[i] += valueLeft * delay;
        this.delaySend.right[i] += valueRight * delay;
      }
    }
  }

  /** Mixage final : sidechain, effets, saturation douce, normalisation et fondu de fin. */
  render({ sidechain = 0.3, delayTime = 0.3, reverbSize = 0.82, drive = 1.6, fadeOut = 0.4 }) {
    const duck = new Float32Array(this.length).fill(1);
    if (sidechain > 0) {
      for (const time of this.kickTimes) {
        const start = Math.round(time * SR);
        const end = Math.min(this.length, start + Math.round(0.35 * SR));
        for (let i = start; i < end; i++) {
          const t = (i - start) / SR;
          duck[i] = Math.min(duck[i], 1 - sidechain * Math.exp(-t / 0.09));
        }
      }
    }
    const room = reverb(this.reverbSend.left, this.reverbSend.right, { size: reverbSize });
    const echo = pingPong(this.delaySend.left, this.delaySend.right, { time: delayTime });
    const left = new Float32Array(this.length);
    const right = new Float32Array(this.length);
    let peak = 0;
    for (let i = 0; i < this.length; i++) {
      const musicLeft = (this.music.left[i] + echo.left[i]) * duck[i];
      const musicRight = (this.music.right[i] + echo.right[i]) * duck[i];
      left[i] = Math.tanh((this.drums.left[i] + musicLeft + room.left[i]) * drive) / Math.tanh(drive);
      right[i] = Math.tanh((this.drums.right[i] + musicRight + room.right[i]) * drive) / Math.tanh(drive);
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    const fadeStart = this.length - Math.round(fadeOut * SR);
    const scale = peak > 0 ? 0.95 / peak : 1;
    for (let i = 0; i < this.length; i++) {
      const fade = i > fadeStart ? (this.length - i) / (this.length - fadeStart) : 1;
      const fadeIn = Math.min(1, i / (0.005 * SR));
      left[i] *= scale * fade * fadeIn;
      right[i] *= scale * fade * fadeIn;
    }
    return { left, right };
  }
}
