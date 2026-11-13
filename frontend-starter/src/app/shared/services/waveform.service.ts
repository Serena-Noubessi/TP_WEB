import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { computeWaveform } from '../audio/waveform';
import { Track } from '../models/track.model';
import { AuthService } from './auth.service';
import { TrackService } from './track.service';

/**
 * Formes d'onde des pistes. Celles qui sont en base arrivent avec les pistes.
 * Pour les pistes envoyées avant leur création, le PROPRIÉTAIRE les complète :
 * quand il affiche ses pistes, le navigateur les calcule une par une (il sait
 * décoder le son, le serveur non) puis les enregistre. Chaque piste n'est
 * traitée qu'une fois par session.
 */
@Injectable({ providedIn: 'root' })
export class WaveformService {
  private readonly tracks = inject(TrackService);
  private readonly auth = inject(AuthService);

  /** Formes d'onde calculées pendant cette session (prioritaires sur celles reçues avec les pistes). */
  readonly computed = signal<ReadonlyMap<string, number[]>>(new Map());
  private readonly tried = new Set<string>();
  private queue: Track[] = [];
  private running = false;

  of(track: Pick<Track, 'id' | 'waveform'>): number[] | null {
    return this.computed().get(track.id) ?? track.waveform ?? null;
  }

  /** Complète les formes d'onde manquantes des pistes de l'utilisateur connecté (une à la fois). */
  backfill(tracks: Track[]): void {
    const me = this.auth.userId();
    if (!me) return;
    for (const track of tracks) {
      const owner = track.ownerId ?? track.author?.id;
      if (track.online || track.waveform?.length || owner !== me || this.tried.has(track.id)) continue;
      this.tried.add(track.id);
      this.queue.push(track);
    }
    void this.run();
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const track = this.queue.shift()!;
        try {
          const blob = await firstValueFrom(this.tracks.audio(track.id));
          const result = await computeWaveform(blob);
          if (!result) continue;
          this.computed.update((map) => new Map(map).set(track.id, result.peaks));
          await firstValueFrom(
            this.tracks.update(track.id, { waveform: result.peaks, ...(!track.durationSeconds && result.duration ? { durationSeconds: result.duration } : {}) }),
          );
        } catch (error) {
          console.warn('[Waveform] Forme d’onde non calculée', track.id, error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
