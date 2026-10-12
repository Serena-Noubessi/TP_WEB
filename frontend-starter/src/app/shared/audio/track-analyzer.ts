import { TrackAnalysis, WaveformData } from '../models/dj.model';

const WAVEFORM_BINS_PER_SECOND = 150;
const MIN_BPM = 70;
const MAX_BPM = 180;
const ANALYSIS_SECONDS = 120;
/** Fenêtre de mesure de l'énergie des basses, en pas d'analyse (6 × 5,8 ms ≈ 35 ms). */
const ENERGY_WINDOW = 6;

/**
 * Calcule la forme d'onde et, si nécessaire, le tempo d'un morceau décodé.
 * Les basses sont isolées par un filtre passe-bas rendu hors temps réel :
 * elles servent à colorer la forme d'onde et à repérer les temps forts.
 */
export async function analyzeTrack(
  buffer: AudioBuffer,
  cached: TrackAnalysis | null,
): Promise<{ analysis: TrackAnalysis; waveform: WaveformData }> {
  const offline = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  const lowpass = offline.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 150;
  source.connect(lowpass).connect(offline.destination);
  source.start();
  const lows = (await offline.startRendering()).getChannelData(0);

  const waveform = computeWaveform(buffer, lows);
  const analysis = cached ?? detectTempo(lows, buffer.sampleRate);
  return { analysis, waveform };
}

function computeWaveform(buffer: AudioBuffer, lows: Float32Array): WaveformData {
  const hop = buffer.sampleRate / WAVEFORM_BINS_PER_SECOND;
  const bins = Math.ceil(buffer.length / hop);
  const peaks = new Float32Array(bins);
  const lowPeaks = new Float32Array(bins);
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, index) =>
    buffer.getChannelData(index),
  );

  let maximum = 0;
  for (let bin = 0; bin < bins; bin++) {
    const start = Math.floor(bin * hop);
    const end = Math.min(buffer.length, Math.floor((bin + 1) * hop));
    let peak = 0;
    let low = 0;
    for (let index = start; index < end; index++) {
      for (const channel of channels) {
        const value = Math.abs(channel[index]);
        if (value > peak) peak = value;
      }
      const lowValue = Math.abs(lows[index]);
      if (lowValue > low) low = lowValue;
    }
    peaks[bin] = peak;
    lowPeaks[bin] = low;
    if (peak > maximum) maximum = peak;
  }

  if (maximum > 0) {
    for (let bin = 0; bin < bins; bin++) {
      peaks[bin] /= maximum;
      lowPeaks[bin] = Math.min(1, lowPeaks[bin] / maximum);
    }
  }

  return { binsPerSecond: WAVEFORM_BINS_PER_SECOND, peaks, lows: lowPeaks };
}

/**
 * Détection du tempo par autocorrélation de l'enveloppe des attaques de basses.
 * Chaque tempo candidat est noté sur ses quatre premiers multiples de période
 * (filtre en peigne), puis la phase du premier temps est recherchée.
 */
export function detectTempo(lows: Float32Array, sampleRate: number): TrackAnalysis {
  const hop = Math.max(1, Math.round(sampleRate / 172));
  const hopSeconds = hop / sampleRate;
  const frames = Math.min(Math.floor(lows.length / hop), Math.floor(ANALYSIS_SECONDS / hopSeconds));
  if (frames < 64) return { bpm: 120, firstBeat: 0 };

  // L'énergie est mesurée sur une fenêtre glissante de ENERGY_WINDOW pas (~35 ms),
  // plus longue qu'une période de grosse caisse (~40–60 Hz, soit 17–25 ms) :
  // sur une fenêtre d'un seul pas (5,8 ms), l'énergie « ondulait » à chaque cycle
  // de l'onde et produisait de fausses attaques toutes les ~11 ms.
  const hopEnergy = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let energy = 0;
    const offset = frame * hop;
    for (let index = 0; index < hop; index++) {
      const value = lows[offset + index];
      energy += value * value;
    }
    hopEnergy[frame] = energy;
  }

  // Compression logarithmique : les attaques restent visibles même sur une
  // musique très compressée, où le niveau des basses varie peu.
  const onset = new Float32Array(frames);
  let windowEnergy = 0;
  let previous = 0;
  let sum = 0;
  for (let frame = 0; frame < frames; frame++) {
    windowEnergy += hopEnergy[frame] - (frame >= ENERGY_WINDOW ? hopEnergy[frame - ENERGY_WINDOW] : 0);
    const level = Math.log1p(1000 * Math.sqrt(Math.max(0, windowEnergy) / (ENERGY_WINDOW * hop)));
    const rise = level - previous;
    onset[frame] = rise > 0 ? rise : 0;
    previous = level;
    sum += onset[frame];
  }

  // Lissage triangulaire (±2 pas) : des impulsions d'un seul pas rendaient le score
  // d'un tempo dépendant de l'alignement de ses multiples sur des pas entiers
  // (125 BPM perdait ainsi contre 83,3 BPM sur une grosse caisse régulière).
  const kernel = [1, 2, 3, 2, 1];
  const spread = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let total = 0;
    for (let offset = -2; offset <= 2; offset++) total += (onset[frame + offset] ?? 0) * kernel[offset + 2];
    spread[frame] = total / 9;
  }
  onset.set(spread);

  const mean = sum / frames;
  for (let frame = 0; frame < frames; frame++) onset[frame] -= mean;

  const maxLag = Math.min(frames - 1, Math.ceil((4 * 60) / (MIN_BPM * hopSeconds)) + 2);
  const correlation = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let total = 0;
    for (let frame = 0; frame + lag < frames; frame++) total += onset[frame] * onset[frame + lag];
    correlation[lag] = total / (frames - lag);
  }

  const correlationAt = (lag: number): number => {
    const index = Math.floor(lag);
    if (index + 1 > maxLag) return 0;
    const fraction = lag - index;
    return correlation[index] + (correlation[index + 1] - correlation[index]) * fraction;
  };

  let bestBpm = 120;
  let bestScore = -Infinity;
  const combScore = (bpm: number): number => {
    const period = 60 / (bpm * hopSeconds);
    let score = 0;
    for (let multiple = 1; multiple <= 4; multiple++) score += correlationAt(period * multiple);
    return score;
  };

  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.05) {
    const score = combScore(bpm);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  // Le peigne note presque autant la moitié du vrai tempo : on préfère le double s'il est aussi probable.
  if (bestBpm * 2 <= MAX_BPM && combScore(bestBpm * 2) >= bestScore * 0.85) bestBpm *= 2;

  // Affinage conjoint du tempo et de la phase sur toute la fenêtre analysée.
  const smoothed = new Float32Array(frames);
  for (let frame = 1; frame < frames - 1; frame++) {
    smoothed[frame] = Math.max(onset[frame - 1], onset[frame], onset[frame + 1]);
  }
  let refinedBpm = bestBpm;
  let bestPhase = 0;
  let bestGridScore = -Infinity;
  for (let bpm = bestBpm - 0.4; bpm <= bestBpm + 0.4; bpm += 0.01) {
    const period = 60 / (bpm * hopSeconds);
    for (let phase = 0; phase < period; phase++) {
      let score = 0;
      for (let position = phase; position < frames - 1; position += period) score += smoothed[Math.round(position)];
      if (score > bestGridScore) {
        bestGridScore = score;
        refinedBpm = bpm;
        bestPhase = phase;
      }
    }
  }

  // Recalage sur le début de l'attaque : une grosse caisse à balayage de hauteur
  // (160 → 45 Hz) entre progressivement sous 150 Hz et sa montée la plus forte
  // arrive jusqu'à ~120 ms après le temps, parfois après une première petite bosse
  // (l'attaque réelle). On replie les attaques sur un temps autour de la phase
  // trouvée, on retient la première bosse atteignant 40 % du maximum, puis on
  // remonte jusqu'au point où elle retombe sous la moitié de sa hauteur.
  const refinedPeriod = 60 / (refinedBpm * hopSeconds);
  const before = Math.round(refinedPeriod * 0.35);
  const after = Math.round(refinedPeriod * 0.1);
  const profile = new Float32Array(before + after + 1);
  for (let position = bestPhase; position < frames; position += refinedPeriod) {
    for (let offset = -before; offset <= after; offset++) {
      const frame = Math.round(position) + offset;
      if (frame >= 0 && frame < frames) profile[offset + before] += onset[frame];
    }
  }
  let maximum = 0;
  for (const value of profile) maximum = Math.max(maximum, value);
  let bumpIndex = before;
  for (let index = 1; index < profile.length - 1; index++) {
    const isLocalPeak = profile[index] >= profile[index - 1] && profile[index] >= profile[index + 1];
    if (isLocalPeak && profile[index] >= maximum * 0.4) {
      bumpIndex = index;
      break;
    }
  }
  let startIndex = bumpIndex;
  while (startIndex > 0 && profile[startIndex - 1] >= profile[bumpIndex] * 0.5) startIndex--;
  let firstBeat = (bestPhase + startIndex - before) * hopSeconds;
  const beatSeconds = refinedPeriod * hopSeconds;
  firstBeat = ((firstBeat % beatSeconds) + beatSeconds) % beatSeconds;

  return {
    bpm: Math.round(refinedBpm * 100) / 100,
    firstBeat,
  };
}
