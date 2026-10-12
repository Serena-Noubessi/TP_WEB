import { computed, signal } from '@angular/core';
import { DeckId, EqBand, FxType, LoopRegion, TrackAnalysis, WaveformData } from '../models/dj.model';
import { Track } from '../models/track.model';
import { DECK_PROCESSOR_NAME } from './deck-processor';
import { readCues, writeCues } from './dj-storage';

/** Rotation d'un vinyle 33 tours : une révolution correspond à 1,8 seconde. */
export const SECONDS_PER_TURN = 1.8;

interface ProcessorPosition {
  type: 'position';
  frame: number;
  rate: number;
  ended: boolean;
}

interface DeckNodes {
  source: AudioWorkletNode;
  eq: Record<EqBand, BiquadFilterNode>;
  highpass: BiquadFilterNode;
  lowpass: BiquadFilterNode;
  echoSend: GainNode;
  echoDelay: DelayNode;
  reverbSend: GainNode;
  flangerWet: GainNode;
  fader: GainNode;
  crossfade: GainNode;
  meter: AnalyserNode;
}

/**
 * État et graphe audio d'une platine.
 * Les signaux existent dès la création pour que l'interface s'affiche avant
 * le premier geste de l'utilisateur ; le graphe Web Audio est attaché ensuite.
 */
export class DeckEngine {
  readonly track = signal<Track | null>(null);
  readonly loading = signal(false);
  /** Avancement du téléchargement d'un morceau en ligne (0 à 1), null si inconnu ou terminé. */
  readonly downloadProgress = signal<number | null>(null);
  readonly analyzing = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly playing = signal(false);
  readonly duration = signal(0);
  readonly time = signal(0);
  readonly analysis = signal<TrackAnalysis | null>(null);
  readonly waveform = signal<WaveformData | null>(null);
  readonly pitch = signal(0);
  readonly pitchRange = signal(8);
  readonly cuePoint = signal(0);
  readonly hotCues = signal<(number | null)[]>([null, null, null, null]);
  readonly loop = signal<LoopRegion | null>(null);
  readonly synced = signal(false);
  readonly scratching = signal(false);
  readonly eq = signal<Record<EqBand, number>>({ high: 0, mid: 0, low: 0 });
  readonly filter = signal(0);
  readonly fx = signal<Record<FxType, number>>({ echo: 0, reverb: 0, flanger: 0 });
  readonly volume = signal(0.8);

  readonly rate = computed(() => 1 + this.pitch() / 100);
  readonly bpm = computed(() => {
    const analysis = this.analysis();
    return analysis ? analysis.bpm * this.rate() : null;
  });

  private ctx?: AudioContext;
  private nodes?: DeckNodes;
  private loadToken = 0;
  private frame = 0;
  private reportedRate = 0;
  private stamp = 0;
  private nudgeFactor = 1;
  private syncFactor = 1;
  private crossfadeGain = 1;
  private meterData = new Float32Array(1024);

  constructor(readonly id: DeckId) {}

  /** Construit la chaîne : lecteur → EQ → filtre → effets → volume → crossfader. */
  attach(ctx: AudioContext, destination: AudioNode, impulse: AudioBuffer): void {
    this.ctx = ctx;
    const source = new AudioWorkletNode(ctx, DECK_PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    source.port.onmessage = (event: MessageEvent<ProcessorPosition>) => this.onPosition(event.data);

    const low = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 220 });
    const mid = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 1000, Q: 0.9 });
    const high = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 3200 });
    const highpass = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 20 });
    const lowpass = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 20000 });
    source.connect(low).connect(mid).connect(high).connect(highpass).connect(lowpass);

    const mix = new GainNode(ctx);
    lowpass.connect(mix);

    // Écho : la commande dose l'envoi, la répétition s'éteint naturellement.
    const echoSend = new GainNode(ctx, { gain: 0 });
    const echoDelay = new DelayNode(ctx, { maxDelayTime: 4, delayTime: 0.375 });
    const echoFeedback = new GainNode(ctx, { gain: 0.45 });
    lowpass.connect(echoSend).connect(echoDelay).connect(mix);
    echoDelay.connect(echoFeedback).connect(echoDelay);

    const reverbSend = new GainNode(ctx, { gain: 0 });
    const reverb = new ConvolverNode(ctx, { buffer: impulse });
    lowpass.connect(reverbSend).connect(reverb).connect(mix);

    // Flanger : un retard très court modulé par un oscillateur lent.
    const flangerDelay = new DelayNode(ctx, { maxDelayTime: 0.05, delayTime: 0.004 });
    const flangerFeedback = new GainNode(ctx, { gain: 0.55 });
    const flangerWet = new GainNode(ctx, { gain: 0 });
    const lfo = new OscillatorNode(ctx, { frequency: 0.25 });
    const lfoDepth = new GainNode(ctx, { gain: 0.003 });
    lfo.connect(lfoDepth).connect(flangerDelay.delayTime);
    lfo.start();
    lowpass.connect(flangerDelay).connect(flangerWet).connect(mix);
    flangerDelay.connect(flangerFeedback).connect(flangerDelay);

    const fader = new GainNode(ctx);
    const crossfade = new GainNode(ctx);
    const meter = new AnalyserNode(ctx, { fftSize: 1024 });
    mix.connect(fader).connect(crossfade).connect(destination);
    fader.connect(meter);

    this.nodes = {
      source,
      eq: { low, mid, high },
      highpass,
      lowpass,
      echoSend,
      echoDelay,
      reverbSend,
      flangerWet,
      fader,
      crossfade,
      meter,
    };
    this.applyAll();
  }

  /** Position de lecture en secondes, extrapolée entre deux messages du processeur. */
  get position(): number {
    if (!this.ctx || !this.loaded()) return 0;
    const elapsed = (performance.now() - this.stamp) / 1000;
    const seconds = this.frame / this.ctx.sampleRate + elapsed * this.reportedRate;
    return Math.min(Math.max(0, seconds), this.duration());
  }

  /** Durée d'un temps en secondes de morceau (indépendante du pitch). */
  get beatLength(): number | null {
    const analysis = this.analysis();
    return analysis ? 60 / analysis.bpm : null;
  }

  /** Avancement dans le temps courant, de 0 à 1. */
  beatPhase(): number | null {
    const analysis = this.analysis();
    const beat = this.beatLength;
    if (!analysis || !beat) return null;
    const phase = (this.position - analysis.firstBeat) / beat;
    return phase - Math.floor(phase);
  }

  /** Niveau crête de la voie (0 à 1) pour le vumètre. */
  level(): number {
    if (!this.nodes) return 0;
    this.nodes.meter.getFloatTimeDomainData(this.meterData);
    let peak = 0;
    for (const value of this.meterData) {
      const absolute = Math.abs(value);
      if (absolute > peak) peak = absolute;
    }
    return Math.min(1, peak);
  }

  beginLoad(track: Track): number {
    this.pause();
    this.post({ type: 'unload' });
    this.track.set(track);
    this.loading.set(true);
    this.downloadProgress.set(null);
    this.analyzing.set(false);
    this.loaded.set(false);
    this.error.set('');
    this.analysis.set(null);
    this.waveform.set(null);
    this.loop.set(null);
    this.synced.set(false);
    this.duration.set(0);
    this.time.set(0);
    this.frame = 0;
    this.reportedRate = 0;
    const cues = readCues(track.id);
    this.cuePoint.set(cues?.cue ?? 0);
    this.hotCues.set([0, 1, 2, 3].map((index) => cues?.hotCues[index] ?? null));
    return ++this.loadToken;
  }

  setDownloadProgress(token: number, progress: number | null): void {
    if (this.isCurrentLoad(token)) this.downloadProgress.set(progress);
  }

  isCurrentLoad(token: number): boolean {
    return token === this.loadToken;
  }

  failLoad(token: number, message: string): void {
    if (!this.isCurrentLoad(token)) return;
    this.loading.set(false);
    this.analyzing.set(false);
    this.downloadProgress.set(null);
    this.error.set(message);
  }

  /** Transmet les échantillons décodés au processeur audio. */
  setBuffer(token: number, buffer: AudioBuffer): void {
    if (!this.isCurrentLoad(token)) return;
    const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, index) =>
      buffer.getChannelData(index).slice(),
    );
    this.nodes?.source.port.postMessage(
      { type: 'load', channels },
      channels.map((channel) => channel.buffer),
    );
    this.duration.set(buffer.duration);
    this.frame = 0;
    this.stamp = performance.now();
    this.loading.set(false);
    this.downloadProgress.set(null);
    this.analyzing.set(true);
    this.loaded.set(true);
  }

  setAnalysis(token: number, analysis: TrackAnalysis, waveform: WaveformData): void {
    if (!this.isCurrentLoad(token)) return;
    this.analysis.set(analysis);
    this.waveform.set(waveform);
    this.analyzing.set(false);
    this.applyEchoTime();
  }

  setBpm(bpm: number): void {
    const analysis = this.analysis();
    if (!analysis) return;
    this.analysis.set({ ...analysis, bpm: Math.round(bpm * 100) / 100 });
    this.applyEchoTime();
  }

  reset(): void {
    this.pause();
    this.post({ type: 'unload' });
    this.loadToken++;
    this.track.set(null);
    this.loading.set(false);
    this.analyzing.set(false);
    this.loaded.set(false);
    this.error.set('');
    this.analysis.set(null);
    this.waveform.set(null);
    this.loop.set(null);
    this.synced.set(false);
    this.duration.set(0);
    this.time.set(0);
  }

  play(): void {
    if (!this.loaded()) return;
    if (this.position >= this.duration() - 0.05) this.seek(0);
    this.post({ type: 'play' });
    this.playing.set(true);
  }

  pause(): void {
    this.post({ type: 'pause' });
    this.playing.set(false);
  }

  togglePlay(): void {
    if (this.playing()) this.pause();
    else this.play();
  }

  /** CUE classique : à l'arrêt, pose le repère ; en lecture, y revient et s'arrête. */
  cue(): void {
    if (!this.loaded()) return;
    if (this.playing()) {
      this.pause();
      this.seek(this.cuePoint());
      return;
    }
    this.cuePoint.set(this.position);
    this.saveCues();
  }

  seek(seconds: number): void {
    if (!this.ctx || !this.loaded()) return;
    const clamped = Math.min(Math.max(0, seconds), this.duration());
    this.frame = clamped * this.ctx.sampleRate;
    this.stamp = performance.now();
    this.time.set(clamped);
    this.post({ type: 'seek', frame: this.frame });
  }

  hotCue(index: number): void {
    if (!this.loaded()) return;
    const point = this.hotCues()[index];
    if (point === null || point === undefined) {
      this.hotCues.update((cues) => cues.map((value, position) => (position === index ? this.position : value)));
      this.saveCues();
      return;
    }
    this.seek(point);
  }

  clearHotCue(index: number): void {
    this.hotCues.update((cues) => cues.map((value, position) => (position === index ? null : value)));
    this.saveCues();
  }

  /** Boucle calée sur la grille rythmique à partir du temps courant. */
  setLoop(beats: number): void {
    const analysis = this.analysis();
    const beat = this.beatLength;
    if (!this.ctx || !analysis || !beat) return;
    const current = this.loop();
    if (current?.beats === beats) {
      this.clearLoop();
      return;
    }
    const start = current
      ? current.start
      : analysis.firstBeat + Math.floor((this.position - analysis.firstBeat) / beat) * beat;
    const region = { start: Math.max(0, start), end: Math.min(this.duration(), start + beats * beat), beats };
    this.loop.set(region);
    const rate = this.ctx.sampleRate;
    this.post({ type: 'loop', start: region.start * rate, end: region.end * rate });
  }

  clearLoop(): void {
    this.loop.set(null);
    this.post({ type: 'loop', start: -1, end: -1 });
  }

  setPitch(percent: number): void {
    const range = this.pitchRange();
    this.pitch.set(Math.min(range, Math.max(-range, Math.round(percent * 100) / 100)));
    this.applySpeed();
    this.applyEchoTime();
  }

  setPitchRange(range: number): void {
    this.pitchRange.set(range);
    this.setPitch(this.pitch());
  }

  /** Accélère ou freine temporairement la platine pour recaler à l'oreille. */
  nudge(direction: -1 | 0 | 1): void {
    this.nudgeFactor = 1 + direction * 0.04;
    this.applySpeed();
  }

  setSyncCorrection(factor: number): void {
    if (this.syncFactor === factor) return;
    this.syncFactor = factor;
    this.applySpeed();
  }

  scratchStart(): void {
    if (!this.loaded()) return;
    this.scratching.set(true);
    this.post({ type: 'scratch-start' });
  }

  scratchTo(seconds: number): void {
    if (!this.ctx || !this.scratching()) return;
    const clamped = Math.min(Math.max(0, seconds), this.duration());
    this.post({ type: 'scratch', frame: clamped * this.ctx.sampleRate });
  }

  scratchEnd(): void {
    if (!this.scratching()) return;
    this.scratching.set(false);
    this.post({ type: 'scratch-end' });
  }

  setEq(band: EqBand, value: number): void {
    this.eq.update((eq) => ({ ...eq, [band]: value }));
    this.applyEq();
  }

  setFilter(value: number): void {
    this.filter.set(value);
    this.applyFilter();
  }

  setFx(type: FxType, value: number): void {
    this.fx.update((fx) => ({ ...fx, [type]: value }));
    this.applyFx();
  }

  setVolume(value: number): void {
    this.volume.set(value);
    this.applyGain();
  }

  setCrossfadeGain(gain: number): void {
    this.crossfadeGain = gain;
    this.applyGain();
  }

  private onPosition(message: ProcessorPosition): void {
    if (!this.ctx) return;
    this.frame = message.frame;
    this.reportedRate = message.rate;
    this.stamp = performance.now();
    const seconds = this.frame / this.ctx.sampleRate;
    if (Math.abs(seconds - this.time()) >= 0.1) this.time.set(seconds);
    if (message.ended) this.playing.set(false);
  }

  private post(message: Record<string, unknown>): void {
    this.nodes?.source.port.postMessage(message);
  }

  private saveCues(): void {
    const track = this.track();
    if (track) writeCues(track.id, { cue: this.cuePoint(), hotCues: this.hotCues() });
  }

  private applyAll(): void {
    this.applySpeed();
    this.applyEq();
    this.applyFilter();
    this.applyFx();
    this.applyGain();
    this.applyEchoTime();
  }

  private applySpeed(): void {
    this.post({ type: 'speed', value: this.rate() * this.nudgeFactor * this.syncFactor });
  }

  /** -1 coupe presque la bande (-26 dB), +1 l'accentue de 6 dB. */
  private applyEq(): void {
    if (!this.nodes || !this.ctx) return;
    const eq = this.eq();
    for (const band of ['low', 'mid', 'high'] as const) {
      const value = eq[band];
      const decibels = value < 0 ? value * 26 : value * 6;
      this.nodes.eq[band].gain.setTargetAtTime(decibels, this.ctx.currentTime, 0.01);
    }
  }

  /** Filtre DJ : à gauche passe-bas, à droite passe-haut, neutre au centre. */
  private applyFilter(): void {
    if (!this.nodes || !this.ctx) return;
    const value = this.filter();
    const now = this.ctx.currentTime;
    const lowpass = value < 0 ? 80 * Math.pow(250, 1 + value) : 20000;
    const highpass = value > 0 ? 20 * Math.pow(200, value) : 20;
    const resonance = Math.abs(value) > 0.02 ? 4 : 0.7;
    this.nodes.lowpass.frequency.setTargetAtTime(lowpass, now, 0.01);
    this.nodes.highpass.frequency.setTargetAtTime(highpass, now, 0.01);
    this.nodes.lowpass.Q.setTargetAtTime(resonance, now, 0.01);
    this.nodes.highpass.Q.setTargetAtTime(resonance, now, 0.01);
  }

  private applyFx(): void {
    if (!this.nodes || !this.ctx) return;
    const fx = this.fx();
    const now = this.ctx.currentTime;
    this.nodes.echoSend.gain.setTargetAtTime(fx.echo * 0.8, now, 0.02);
    this.nodes.reverbSend.gain.setTargetAtTime(fx.reverb * 1.2, now, 0.02);
    this.nodes.flangerWet.gain.setTargetAtTime(fx.flanger, now, 0.02);
  }

  private applyGain(): void {
    if (!this.nodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.nodes.fader.gain.setTargetAtTime(this.volume() * this.volume(), now, 0.01);
    this.nodes.crossfade.gain.setTargetAtTime(this.crossfadeGain, now, 0.01);
  }

  /** L'écho répète la note pointée (3/4 de temps) au tempo joué. */
  private applyEchoTime(): void {
    if (!this.nodes || !this.ctx) return;
    const bpm = this.bpm();
    const delay = bpm ? Math.min(3.9, (60 / bpm) * 0.75) : 0.375;
    this.nodes.echoDelay.delayTime.setTargetAtTime(delay, this.ctx.currentTime, 0.05);
  }
}
