import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { categoryOf, displayTitle } from '../models/category.model';
import { Track } from '../models/track.model';
import { AuthService } from './auth.service';
import { TrackService } from './track.service';

export type RepeatMode = 'off' | 'all' | 'one';

const SETTINGS_KEY = 'gpc_audio_player';
export const MIN_RATE = 0.5;
export const MAX_RATE = 2;

interface PlayerSettings {
  volume: number;
  rate: number;
  preservePitch: boolean;
}

/**
 * Lecteur de l'onglet Audio, partagé par toute l'application.
 * Il vit en dehors des composants : la musique continue « en arrière-plan »
 * quand on change d'onglet (un mini-lecteur reste dans la barre du haut), et les
 * touches multimédia du clavier ou du téléphone le pilotent (Media Session API).
 *
 * Chaîne audio : <audio> → analyse Butterchurn (avant le volume, pour que les visuels
 * suivent le rythme même à faible volume) → volume → haut-parleurs.
 */
@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private readonly tracks = inject(TrackService);
  private readonly auth = inject(AuthService);

  readonly queue = signal<Track[]>([]);
  readonly index = signal(-1);
  readonly current = computed(() => this.queue()[this.index()] ?? null);
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly time = signal(0);
  readonly duration = signal(0);
  readonly rate = signal(1);
  readonly preservePitch = signal(true);
  readonly volume = signal(0.8);
  readonly muted = signal(false);
  readonly shuffle = signal(false);
  readonly repeat = signal<RepeatMode>('all');

  private audio?: HTMLAudioElement;
  private ctx?: AudioContext;
  private source?: MediaElementAudioSourceNode;
  private gain?: GainNode;
  private objectUrl = '';
  private loadToken = 0;

  constructor() {
    this.restoreSettings();
    effect(() => {
      if (!this.auth.token()) untracked(() => this.stop());
    });
  }

  /** Contexte audio et nœud analysé par Butterchurn (crée le graphe si besoin). */
  async visualSource(): Promise<{ context: AudioContext; output: AudioNode }> {
    this.ensureGraph();
    // Reprise demandée sans l'attendre : Butterchurn peut être branché sur un contexte
    // encore suspendu, il s'anime dès que le son démarre.
    void this.ctx?.resume();
    return { context: this.ctx as AudioContext, output: this.source as AudioNode };
  }

  /** Lance la lecture d'une liste de morceaux à partir de `index` (appelé sur un clic : geste utilisateur). */
  playList(tracks: Track[], index: number): void {
    this.ensureGraph();
    this.queue.set(tracks);
    this.load(index);
  }

  togglePlay(): void {
    const audio = this.audio;
    if (!audio || !this.current()) return;
    this.ensureGraph();
    if (audio.paused) this.resume();
    else audio.pause();
  }

  next(auto = false): void {
    const length = this.queue().length;
    if (!length) return;
    if (auto && this.repeat() === 'one') {
      this.seek(0);
      this.resume();
      return;
    }
    let target: number;
    if (this.shuffle() && length > 1) {
      do target = Math.floor(Math.random() * length);
      while (target === this.index());
    } else {
      target = this.index() + 1;
      if (target >= length) {
        if (auto && this.repeat() === 'off') {
          this.playing.set(false);
          return;
        }
        target = 0;
      }
    }
    this.load(target);
  }

  /** Après 3 secondes, « précédent » revient au début du morceau, comme sur la plupart des lecteurs. */
  previous(): void {
    if (!this.queue().length) return;
    if (this.time() > 3) {
      this.seek(0);
      return;
    }
    this.load((this.index() - 1 + this.queue().length) % this.queue().length);
  }

  seek(seconds: number): void {
    if (!this.audio || !Number.isFinite(seconds)) return;
    this.audio.currentTime = Math.min(Math.max(0, seconds), this.duration() || 0);
    this.time.set(this.audio.currentTime);
  }

  /** Vitesse de lecture de 0,5× à 2×. Avec « conserver la tonalité », la musique va plus vite sans devenir aiguë. */
  setRate(rate: number): void {
    const clamped = Math.round(Math.min(MAX_RATE, Math.max(MIN_RATE, rate)) * 100) / 100;
    this.rate.set(clamped);
    if (this.audio) this.audio.playbackRate = clamped;
    this.saveSettings();
  }

  setPreservePitch(enabled: boolean): void {
    this.preservePitch.set(enabled);
    if (this.audio) this.audio.preservesPitch = enabled;
    this.saveSettings();
  }

  setVolume(volume: number): void {
    this.volume.set(Math.min(1, Math.max(0, volume)));
    if (this.volume() > 0) this.muted.set(false);
    this.applyVolume();
    this.saveSettings();
  }

  toggleMute(): void {
    this.muted.update((muted) => !muted);
    this.applyVolume();
  }

  toggleShuffle(): void {
    this.shuffle.update((value) => !value);
  }

  cycleRepeat(): void {
    this.repeat.update((mode) => (mode === 'all' ? 'one' : mode === 'one' ? 'off' : 'all'));
  }

  stop(): void {
    this.loadToken++;
    this.audio?.pause();
    if (this.audio) this.audio.removeAttribute('src');
    this.revokeUrl();
    this.queue.set([]);
    this.index.set(-1);
    this.playing.set(false);
    this.loading.set(false);
    this.time.set(0);
    this.duration.set(0);
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }

  private load(index: number): void {
    const track = this.queue()[index];
    const audio = this.ensureAudio();
    if (!track) return;
    const token = ++this.loadToken;
    this.index.set(index);
    this.error.set('');
    this.loading.set(true);
    this.time.set(0);
    this.duration.set(track.online?.durationSeconds ?? 0);
    audio.pause();
    this.updateMediaSession(track);

    if (track.online) {
      this.revokeUrl();
      this.startSource(token, track.online.audioUrl);
      return;
    }
    this.tracks.audio(track.id).subscribe({
      next: (blob) => {
        if (token !== this.loadToken) return;
        this.revokeUrl();
        this.objectUrl = URL.createObjectURL(blob);
        this.startSource(token, this.objectUrl);
      },
      error: (error: HttpErrorResponse) => {
        if (token !== this.loadToken) return;
        console.error('[AudioPlayer] Téléchargement impossible', error);
        this.loading.set(false);
        this.error.set(error.status === 401 ? 'Session expirée : reconnectez-vous.' : 'Impossible de charger ce morceau.');
      },
    });
  }

  private startSource(token: number, url: string): void {
    const audio = this.ensureAudio();
    if (token !== this.loadToken) return;
    audio.src = url;
    audio.playbackRate = this.rate();
    audio.preservesPitch = this.preservePitch();
    this.resume();
  }

  private resume(): void {
    const audio = this.audio;
    if (!audio) return;
    void this.ctx?.resume();
    audio.playbackRate = this.rate();
    audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[AudioPlayer] Lecture impossible', error);
      this.loading.set(false);
      this.error.set(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Le navigateur a bloqué la lecture : cliquez sur Lecture.'
          : 'Ce morceau ne peut pas être lu.',
      );
    });
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = document.createElement('audio');
    // Nécessaire pour analyser un fichier d'un autre site (Jamendo…) avec Web Audio.
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.addEventListener('timeupdate', () => this.time.set(audio.currentTime));
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration)) this.duration.set(audio.duration);
    });
    audio.addEventListener('playing', () => {
      this.loading.set(false);
      this.playing.set(true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    });
    audio.addEventListener('pause', () => {
      this.playing.set(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
    audio.addEventListener('waiting', () => this.loading.set(true));
    audio.addEventListener('ended', () => this.next(true));
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src')) return;
      this.loading.set(false);
      this.playing.set(false);
      this.error.set('Ce fichier ne peut pas être lu (format non pris en charge ou fichier indisponible).');
    });
    this.audio = audio;
    this.registerMediaKeys();
    return audio;
  }

  /** Le graphe Web Audio est créé lors d'un geste de l'utilisateur (règle des navigateurs). */
  private ensureGraph(): void {
    const audio = this.ensureAudio();
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaElementSource(audio);
    this.gain = this.ctx.createGain();
    this.source.connect(this.gain).connect(this.ctx.destination);
    this.applyVolume();
  }

  /** Courbe quadratique : le curseur de volume paraît plus régulier à l'oreille. */
  private applyVolume(): void {
    if (!this.gain || !this.ctx) return;
    const level = this.muted() ? 0 : this.volume() * this.volume();
    this.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.02);
  }

  private updateMediaSession(track: Track): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: displayTitle(track),
      artist: track.online?.artist ?? 'Guitar Practice Cloud',
      album: categoryOf(track).label,
      artwork: track.online?.imageUrl ? [{ src: track.online.imageUrl, sizes: '300x300' }] : [],
    });
  }

  /** Touches multimédia (clavier, casque, écran de verrouillage du téléphone). */
  private registerMediaKeys(): void {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => this.resume()],
      ['pause', () => this.audio?.pause()],
      ['previoustrack', () => this.previous()],
      ['nexttrack', () => this.next()],
      ['seekto', (details) => this.seek(details.seekTime ?? 0)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action non prise en charge par ce navigateur.
      }
    }
  }

  private revokeUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = '';
  }

  private restoreSettings(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<PlayerSettings> | null;
      if (typeof saved?.volume === 'number') this.volume.set(Math.min(1, Math.max(0, saved.volume)));
      if (typeof saved?.rate === 'number') this.rate.set(Math.min(MAX_RATE, Math.max(MIN_RATE, saved.rate)));
      if (typeof saved?.preservePitch === 'boolean') this.preservePitch.set(saved.preservePitch);
    } catch {
      // Préférences absentes ou illisibles : valeurs par défaut.
    }
  }

  private saveSettings(): void {
    try {
      const settings: PlayerSettings = { volume: this.volume(), rate: this.rate(), preservePitch: this.preservePitch() };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Stockage indisponible : les réglages ne seront pas retenus.
    }
  }
}
