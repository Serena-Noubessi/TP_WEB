import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { CatalogTrack } from '../catalogs/music-catalog';
import { OnlineAudioError } from '../audio/online-audio-error';
import { checkDecodable, downloadAudio, DownloadProgress, parseAudioUrl } from '../audio/remote-audio';
import { OnlineSource, Track } from '../models/track.model';
import { AuthService } from './auth.service';

const STORAGE_PREFIX = 'gpc_online_tracks_';
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
 * Le backend n'est pas modifié : il ne connaît que les fichiers téléversés. Ces
 * morceaux sont donc gardés comme de simples références (titre, artiste, source,
 * licence, adresse du fichier) dans ce navigateur, une liste par compte. Le fichier
 * lui-même n'est jamais copié sur le serveur — Jamendo interdit de stocker ses
 * morceaux — : il est téléchargé en mémoire au moment de l'écouter ou de le mixer.
 */
@Injectable({ providedIn: 'root' })
export class OnlineTrackService {
  private readonly auth = inject(AuthService);
  private readonly memory = new Map<string, Blob>();

  private readonly owner = computed(() => this.ownerFromToken(this.auth.token()));
  readonly tracks = signal<Track[]>([]);

  constructor() {
    effect(() => {
      const owner = this.owner();
      untracked(() => this.tracks.set(owner ? this.read(owner) : []));
    });
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

  remove(id: string): void {
    const track = this.tracks().find((item) => item.id === id);
    if (track?.online) this.memory.delete(track.online.audioUrl);
    this.tracks.update((tracks) => tracks.filter((item) => item.id !== id));
    this.persist();
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

  private save(online: OnlineSource, title: string, originalName: string, blob: Blob): Track {
    const track: Track = {
      id: `online-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      originalName,
      mimeType: blob.type || 'audio/mpeg',
      size: blob.size,
      coverUrl: null,
      createdAt: new Date().toISOString(),
      online,
    };
    this.remember(online.audioUrl, blob);
    this.tracks.update((tracks) => [track, ...tracks]);
    this.persist();
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

  private read(owner: string): Track[] {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + owner);
      const tracks = raw ? (JSON.parse(raw) as Track[]) : [];
      return Array.isArray(tracks) ? tracks.filter((track) => track.online?.audioUrl) : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    const owner = this.owner();
    if (!owner) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + owner, JSON.stringify(this.tracks()));
    } catch (error) {
      console.warn('[OnlineTracks] Enregistrement impossible', error);
    }
  }
}
