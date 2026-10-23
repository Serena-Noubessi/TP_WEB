import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CatalogTrack } from '../catalogs/music-catalog';
import { OnlineAudioError } from '../audio/online-audio-error';
import { checkDecodable, downloadAudio, DownloadProgress, parseAudioUrl } from '../audio/remote-audio';
import { OnlineSource, Track } from '../models/track.model';
import { findCategory, guessCategory } from '../models/category.model';
import { AuthService } from './auth.service';

/** Ancienne clé de stockage dans le navigateur (avant MOST VIBE étape 2), reprise une seule fois. */
const LEGACY_STORAGE_PREFIX = 'gpc_online_tracks_';
/** Nombre de fichiers gardés en mémoire pendant la session (pas de stockage durable). */
const MEMORY_CACHE_SIZE = 3;

export interface UrlTrackInput {
  url: string;
  title: string;
  artist: string;
  license: string;
  category: string;
}

/**
 * Morceaux ajoutés depuis internet.
 * MOST VIBE étape 2 : les références (titre, artiste, source, licence, adresse du
 * fichier) sont enregistrées EN BASE via /api/external-tracks, une liste par compte.
 * Le fichier lui-même n'est jamais copié sur le serveur — Jamendo interdit de
 * stocker ses morceaux — : il est téléchargé en mémoire au moment de l'écouter ou
 * de le mixer. Les listes que l'ancienne version gardait dans le navigateur sont
 * envoyées au serveur une seule fois, puis effacées du navigateur.
 */
@Injectable({ providedIn: 'root' })
export class OnlineTrackService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly memory = new Map<string, Blob>();

  private readonly owner = computed(() => this.ownerFromToken(this.auth.token()));
  readonly tracks = signal<Track[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');

  constructor() {
    effect(() => {
      const owner = this.owner();
      untracked(() => {
        this.tracks.set([]);
        if (owner) void this.load(owner);
      });
    });
  }

  /** Charge la liste depuis le serveur (après avoir repris l'éventuelle ancienne liste du navigateur). */
  async load(owner = this.owner()): Promise<void> {
    if (!owner) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      await this.migrateLegacy(owner);
      const { docs } = await firstValueFrom(this.http.get<{ docs: Track[] }>('/api/external-tracks'));
      if (this.owner() === owner) this.tracks.set(docs);
    } catch (error) {
      console.error('[OnlineTracks] Chargement impossible', error);
      this.loadError.set('Impossible de charger vos morceaux en ligne. Vérifiez votre connexion.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Morceaux dont le titre, l'artiste ou la source contiennent le texte cherché. */
  filtered(search: string): Track[] {
    const needle = search.trim().toLowerCase();
    if (!needle) return this.tracks();
    return this.tracks().filter((track) =>
      [track.title, track.online?.artist, track.online?.sourceLabel].some((value) => value?.toLowerCase().includes(needle)),
    );
  }

  /** Ajoute un fichier depuis son lien direct, après l'avoir téléchargé et décodé une première fois. */
  async addFromUrl(input: UrlTrackInput, onProgress: (progress: DownloadProgress) => void, signal: AbortSignal): Promise<Track> {
    const url = parseAudioUrl(input.url);
    this.assertNotAdded(url.href);
    const blob = await downloadAudio(url.href, onProgress, signal);
    const duration = await checkDecodable(blob);
    const fileName = decodeURIComponent(url.pathname.split('/').pop() || url.hostname);
    return this.save(
      {
        audioUrl: url.href,
        artist: input.artist.trim() || 'Artiste inconnu',
        sourceId: 'url',
        sourceLabel: url.hostname.replace(/^www\./, ''),
        pageUrl: url.href,
        license: input.license.trim() || 'Licence non précisée',
        licenseUrl: null,
        imageUrl: null,
        durationSeconds: Math.round(duration),
        category: input.category,
      },
      input.title.trim() || fileName.replace(/\.[a-z0-9]+$/i, ''),
      fileName,
      blob,
    );
  }

  /** Ajoute un morceau trouvé dans un catalogue (Jamendo…), après vérification du téléchargement. */
  async addFromCatalog(item: CatalogTrack, sourceLabel: string, category: string, onProgress: (progress: DownloadProgress) => void, signal: AbortSignal): Promise<Track> {
    this.assertNotAdded(item.audioUrl);
    const blob = await downloadAudio(item.audioUrl, onProgress, signal);
    const duration = await checkDecodable(blob);
    return this.save(
      {
        audioUrl: item.audioUrl,
        artist: item.artist,
        sourceId: item.catalogId,
        sourceLabel,
        pageUrl: item.pageUrl,
        license: item.license,
        licenseUrl: item.licenseUrl,
        imageUrl: item.imageUrl,
        durationSeconds: item.durationSeconds ?? Math.round(duration),
        category,
      },
      item.title,
      `${item.artist} - ${item.title}.mp3`,
      blob,
    );
  }

  isAdded(audioUrl: string): boolean {
    return this.tracks().some((track) => track.online?.audioUrl === audioUrl);
  }

  /** Retire un morceau de la liste (la référence seulement ; le fichier reste chez sa source). */
  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/external-tracks/${id}`));
    const track = this.tracks().find((item) => item.id === id);
    if (track?.online) this.memory.delete(track.online.audioUrl);
    this.tracks.update((tracks) => tracks.filter((item) => item.id !== id));
  }

  /** Fichier audio d'un morceau en ligne, pour le moteur des decks. */
  async fetchAudio(track: Track, onProgress: (progress: DownloadProgress) => void, signal: AbortSignal): Promise<Blob> {
    const url = track.online?.audioUrl;
    if (!url) throw new OnlineAudioError('invalid-url', 'Ce morceau n’a pas d’adresse en ligne.');
    const cached = this.memory.get(url);
    if (cached) {
      onProgress({ loaded: cached.size, total: cached.size, bytesPerSecond: 0 });
      return cached;
    }
    const blob = await downloadAudio(url, onProgress, signal);
    this.remember(url, blob);
    return blob;
  }

  private async save(online: OnlineSource, title: string, originalName: string, blob: Blob): Promise<Track> {
    let track: Track;
    try {
      track = await firstValueFrom(
        this.http.post<Track>('/api/external-tracks', toPayload(online, title, originalName, blob.type || 'audio/mpeg', blob.size)),
      );
    } catch (error) {
      console.error('[OnlineTracks] Enregistrement refusé', error);
      const message = (error as { error?: { message?: string } }).error?.message;
      throw new OnlineAudioError('unreachable', message ? `Enregistrement impossible : ${message}` : 'Enregistrement impossible : le serveur ne répond pas.');
    }
    this.remember(online.audioUrl, blob);
    this.tracks.update((tracks) => [track, ...tracks.filter((item) => item.id !== track.id)]);
    return track;
  }

  private assertNotAdded(audioUrl: string): void {
    if (this.isAdded(audioUrl)) throw new OnlineAudioError('duplicate', 'Ce morceau est déjà dans votre liste.');
  }

  private remember(url: string, blob: Blob): void {
    this.memory.delete(url);
    this.memory.set(url, blob);
    while (this.memory.size > MEMORY_CACHE_SIZE) this.memory.delete(this.memory.keys().next().value as string);
  }

  /** Identifiant de l'utilisateur lu dans le jeton (champ « sub »), pour séparer les listes par compte. */
  private ownerFromToken(token: string | null): string | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown };
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }

  /**
   * Reprise unique de l'ancienne liste gardée dans le navigateur : elle est envoyée
   * au serveur, puis effacée du navigateur seulement si le serveur l'a acceptée.
   */
  private async migrateLegacy(owner: string): Promise<void> {
    const key = LEGACY_STORAGE_PREFIX + owner;
    let legacy: Track[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Track[];
      legacy = Array.isArray(parsed) ? parsed.filter((track) => track.online?.audioUrl) : [];
    } catch {
      return;
    }
    if (legacy.length) {
      const items = legacy.map((track) => toPayload(track.online!, track.title, track.originalName, track.mimeType, track.size));
      const result = await firstValueFrom(this.http.post<{ docs: Track[]; rejected: unknown[] }>('/api/external-tracks', { items }));
      console.log(`[OnlineTracks] ${result.docs.length} morceau(x) repris du navigateur, ${result.rejected.length} refusé(s)`);
    }
    localStorage.removeItem(key);
  }
}

/** Corps envoyé à POST /api/external-tracks. */
function toPayload(online: OnlineSource, title: string, originalName: string, mimeType: string, size: number) {
  return {
    title,
    originalName,
    mimeType,
    size,
    audioUrl: online.audioUrl,
    artist: online.artist,
    sourceId: online.sourceId,
    sourceLabel: online.sourceLabel,
    pageUrl: online.pageUrl,
    license: online.license,
    licenseUrl: online.licenseUrl,
    imageUrl: online.imageUrl,
    durationSeconds: online.durationSeconds,
    // Les anciennes catégories (house, techno…) sont ramenées aux 7 styles MOST VIBE.
    style: (findCategory(online.category) ?? guessCategory(online.category))?.id ?? 'autres',
  };
}
