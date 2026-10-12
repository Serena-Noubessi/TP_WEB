import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DeckEngine } from '../audio/deck-engine';
import { DECK_PROCESSOR_SOURCE } from '../audio/deck-processor';
import { readAnalysis, writeAnalysis } from '../audio/dj-storage';
import { analyzeTrack } from '../audio/track-analyzer';
import { DeckId } from '../models/dj.model';
import { Track } from '../models/track.model';
import { AuthService } from './auth.service';
import { OnlineAudioError } from '../audio/online-audio-error';
import { OnlineTrackService } from './online-track.service';
import { TrackService } from './track.service';

const SYNC_INTERVAL_MS = 250;

/**
 * Moteur de la table de mixage, partagé par toute l'application.
 * Il vit en dehors des composants : le mix continue quand on change d'onglet.
 */
@Injectable({ providedIn: 'root' })
export class DjEngineService {
  private readonly tracks = inject(TrackService);
  private readonly auth = inject(AuthService);
  private readonly online = inject(OnlineTrackService);
  private readonly downloads: Partial<Record<DeckId, AbortController>> = {};

  readonly decks: Record<DeckId, DeckEngine> = { A: new DeckEngine('A'), B: new DeckEngine('B') };
  readonly crossfader = signal(0);
  readonly masterVolume = signal(0.9);
  readonly audioError = signal('');
  readonly syncMessage = signal('');
  readonly recording = signal(false);
  readonly recordingUrl = signal('');

  private ctx?: AudioContext;
  private ready?: Promise<AudioContext>;
  private masterGain?: GainNode;
  private masterMeter?: AnalyserNode;
  private masterOutput?: AudioNode;
  private recordDestination?: MediaStreamAudioDestinationNode;
  private recorder?: MediaRecorder;
  private recordChunks: Blob[] = [];
  private meterData = new Float32Array(1024);
  private syncTimer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      if (!this.auth.token()) untracked(() => this.stopEverything());
    });
  }

  deck(id: DeckId): DeckEngine {
    return this.decks[id];
  }

  other(id: DeckId): DeckEngine {
    return this.decks[id === 'A' ? 'B' : 'A'];
  }

  /**
   * Crée l'AudioContext pendant le geste de l'utilisateur (exigence des
   * navigateurs), puis charge le processeur de platine et construit le graphe.
   */
  ensureAudio(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ready = this.buildGraph(this.ctx);
    }
    void this.ctx.resume();
    return this.ready as Promise<AudioContext>;
  }

  loadTrack(id: DeckId, track: Track): void {
    const deck = this.deck(id);
    const token = deck.beginLoad(track);
    const audioReady = this.ensureAudio();
    console.debug(`[DjEngine] Chargement de « ${track.title} » sur la platine ${id}`);
    this.downloads[id]?.abort();

    // Morceau en ligne : téléchargé en mémoire par fetch, puis décodé exactement
    // comme un fichier local (même moteur : scratch, EQ, effets, BPM, sync).
    if (track.online) {
      const controller = new AbortController();
      this.downloads[id] = controller;
      this.online
        .fetchAudio(track, (progress) => deck.setDownloadProgress(token, progress.total ? progress.loaded / progress.total : null), controller.signal)
        .then((blob) => this.decodeInto(deck, token, track, blob, audioReady))
        .catch((error: unknown) => {
          if (error instanceof OnlineAudioError && error.kind === 'cancelled') return;
          console.error(`[DjEngine] Téléchargement en ligne impossible pour la platine ${id}`, error);
          deck.failLoad(token, error instanceof OnlineAudioError ? error.message : 'Impossible de télécharger ce morceau en ligne.');
        });
      return;
    }

    this.tracks.audio(track.id).subscribe({
      next: (blob) => {
        void this.decodeInto(deck, token, track, blob, audioReady);
      },
      error: (error: HttpErrorResponse) => {
        console.error(`[DjEngine] Téléchargement impossible pour la platine ${id}`, error);
        deck.failLoad(
          token,
          error.status === 401
            ? 'Session expirée : reconnectez-vous pour charger ce morceau.'
            : 'Impossible de télécharger ce morceau.',
        );
      },
    });
  }

  togglePlay(id: DeckId): void {
    this.ensureAudio().catch(() => undefined);
    this.deck(id).togglePlay();
  }

  /** Active la synchro : même tempo que l'autre platine, puis calage des temps. */
  toggleSync(id: DeckId): void {
    const deck = this.deck(id);
    const master = this.other(id);
    this.syncMessage.set('');

    if (deck.synced()) {
      deck.synced.set(false);
      deck.setSyncCorrection(1);
      return;
    }
    if (!deck.analysis() || !master.analysis()) {
      this.syncMessage.set('La synchro nécessite deux morceaux chargés et analysés.');
      return;
    }
    if (!this.matchTempo(deck, master)) {
      this.syncMessage.set('Les tempos sont trop éloignés pour être synchronisés.');
      return;
    }
    master.synced.set(false);
    master.setSyncCorrection(1);
    deck.synced.set(true);
    if (master.playing()) this.alignPhase(deck, master);
  }

  setPitch(id: DeckId, percent: number): void {
    const deck = this.deck(id);
    deck.setPitch(percent);
    if (deck.synced()) {
      deck.synced.set(false);
      deck.setSyncCorrection(1);
    }
    const follower = this.other(id);
    if (follower.synced()) this.matchTempo(follower, deck);
  }

  /** Corrige un tempo détecté au double ou à la moitié de la valeur réelle. */
  scaleBpm(id: DeckId, factor: 0.5 | 2): void {
    const deck = this.deck(id);
    const analysis = deck.analysis();
    const track = deck.track();
    if (!analysis || !track) return;
    deck.setBpm(analysis.bpm * factor);
    const updated = deck.analysis();
    if (updated) writeAnalysis(track.id, updated);
    if (deck.synced()) this.matchTempo(deck, this.other(id));
    const follower = this.other(id);
    if (follower.synced()) this.matchTempo(follower, deck);
  }

  setCrossfader(value: number): void {
    this.crossfader.set(value);
    this.applyCrossfader();
  }

  setMasterVolume(value: number): void {
    this.masterVolume.set(value);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(value * value, this.ctx.currentTime, 0.01);
    }
  }

  /** Sortie master (après limiteur), utilisée par le visualiseur Butterchurn. */
  async masterSource(): Promise<{ context: AudioContext; output: AudioNode }> {
    const context = await this.ensureAudio();
    return { context, output: this.masterOutput as AudioNode };
  }

  masterLevel(): number {
    if (!this.masterMeter) return 0;
    this.masterMeter.getFloatTimeDomainData(this.meterData);
    let peak = 0;
    for (const value of this.meterData) peak = Math.max(peak, Math.abs(value));
    return Math.min(1, peak);
  }

  /** Enregistre la sortie master dans un fichier audio téléchargeable. */
  toggleRecording(): void {
    if (this.recording()) {
      this.recorder?.stop();
      return;
    }
    this.ensureAudio().then(() => {
      if (!this.recordDestination || typeof MediaRecorder === 'undefined') {
        this.audioError.set("L'enregistrement n'est pas pris en charge par ce navigateur.");
        return;
      }
      const previous = this.recordingUrl();
      if (previous) URL.revokeObjectURL(previous);
      this.recordingUrl.set('');
      this.recordChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(this.recordDestination.stream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordChunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(this.recordChunks, { type: recorder.mimeType || 'audio/webm' });
        this.recordingUrl.set(URL.createObjectURL(blob));
        this.recording.set(false);
        console.debug('[DjEngine] Mix enregistré', blob.size);
      };
      recorder.start(1000);
      this.recorder = recorder;
      this.recording.set(true);
    }).catch(() => undefined);
  }

  private async buildGraph(ctx: AudioContext): Promise<AudioContext> {
    const moduleUrl = URL.createObjectURL(new Blob([DECK_PROCESSOR_SOURCE], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(moduleUrl);
    } catch (error) {
      console.error('[DjEngine] AudioWorklet indisponible', error);
      this.audioError.set('Ce navigateur ne permet pas de charger le moteur audio de la table de mixage.');
      throw error;
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }

    this.masterGain = new GainNode(ctx, { gain: this.masterVolume() * this.masterVolume() });
    const limiter = new DynamicsCompressorNode(ctx, {
      threshold: -1.5,
      knee: 0,
      ratio: 12,
      attack: 0.003,
      release: 0.25,
    });
    this.masterMeter = new AnalyserNode(ctx, { fftSize: 1024 });
    this.recordDestination = ctx.createMediaStreamDestination();
    this.masterGain.connect(limiter);
    limiter.connect(ctx.destination);
    limiter.connect(this.masterMeter);
    limiter.connect(this.recordDestination);
    this.masterOutput = limiter;

    const impulse = this.createImpulse(ctx);
    this.decks.A.attach(ctx, this.masterGain, impulse);
    this.decks.B.attach(ctx, this.masterGain, impulse);
    this.applyCrossfader();
    this.syncTimer ??= setInterval(() => this.keepInSync(), SYNC_INTERVAL_MS);
    return ctx;
  }

  private async decodeInto(
    deck: DeckEngine,
    token: number,
    track: Track,
    blob: Blob,
    audioReady: Promise<AudioContext>,
  ): Promise<void> {
    try {
      const ctx = await audioReady;
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      deck.setBuffer(token, buffer);
      if (!deck.isCurrentLoad(token)) return;

      // Analyse en arrière-plan : la platine est déjà jouable pendant ce calcul.
      const cached = readAnalysis(track.id);
      const result = await analyzeTrack(buffer, cached);
      if (!cached) writeAnalysis(track.id, result.analysis);
      deck.setAnalysis(token, result.analysis, result.waveform);
      console.debug(`[DjEngine] Analyse de « ${track.title} » : ${result.analysis.bpm} BPM`);
    } catch (error) {
      console.error('[DjEngine] Décodage ou analyse impossible', error);
      deck.failLoad(token, 'Ce fichier audio ne peut pas être décodé par le navigateur.');
    }
  }

  /** Règle le pitch de `deck` pour jouer au tempo de `master` (ou à son double/moitié). */
  private matchTempo(deck: DeckEngine, master: DeckEngine): boolean {
    const target = master.bpm();
    const base = deck.analysis()?.bpm;
    if (!target || !base) return false;

    const ratio = [target / base, (target * 2) / base, target / (base * 2)].reduce((best, candidate) =>
      Math.abs(candidate - 1) < Math.abs(best - 1) ? candidate : best,
    );
    const pitch = (ratio - 1) * 100;
    if (Math.abs(pitch) > 50) return false;
    if (Math.abs(pitch) > deck.pitchRange()) deck.setPitchRange(Math.abs(pitch) <= 16 ? 16 : 50);
    deck.setPitch(pitch);
    return true;
  }

  /** Écart de phase en temps (-0,5 à 0,5) ; positif si `deck` est en avance. */
  private phaseError(deck: DeckEngine, master: DeckEngine): number | null {
    const phase = deck.beatPhase();
    const masterPhase = master.beatPhase();
    if (phase === null || masterPhase === null) return null;
    let difference = phase - masterPhase;
    if (difference > 0.5) difference -= 1;
    if (difference < -0.5) difference += 1;
    return difference;
  }

  private alignPhase(deck: DeckEngine, master: DeckEngine): void {
    const error = this.phaseError(deck, master);
    const beat = deck.beatLength;
    if (error === null || !beat) return;
    deck.seek(deck.position - error * beat);
  }

  /**
   * Synchro rythmique en arrière-plan : quatre fois par seconde, la platine
   * synchronisée accélère ou ralentit très légèrement pour rester calée.
   */
  private keepInSync(): void {
    for (const id of ['A', 'B'] as const) {
      const deck = this.deck(id);
      const master = this.other(id);
      const active =
        deck.synced() && deck.playing() && master.playing() && !deck.scratching() && !master.scratching();
      const error = active ? this.phaseError(deck, master) : null;
      const bpm = deck.bpm();
      if (error === null || !bpm) {
        deck.setSyncCorrection(1);
        continue;
      }

      const seconds = (error * 60) / bpm;
      if (Math.abs(seconds) > 0.08) {
        deck.setSyncCorrection(1);
        this.alignPhase(deck, master);
      } else {
        deck.setSyncCorrection(1 - Math.min(0.02, Math.max(-0.02, seconds * 0.8)));
      }
    }
  }

  /** Courbe à puissance constante : le volume perçu reste stable au centre. */
  private applyCrossfader(): void {
    const position = (this.crossfader() + 1) / 2;
    this.decks.A.setCrossfadeGain(Math.cos((position * Math.PI) / 2));
    this.decks.B.setCrossfadeGain(Math.sin((position * Math.PI) / 2));
  }

  /** Réponse impulsionnelle synthétique (bruit à décroissance exponentielle). */
  private createImpulse(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 2.4);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index++) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 3);
      }
    }
    return impulse;
  }

  private stopEverything(): void {
    if (this.recording()) this.recorder?.stop();
    this.decks.A.reset();
    this.decks.B.reset();
  }
}
