import { CatalogError, CatalogPage, CatalogTrack, licenseLabel, MusicCatalog } from './music-catalog';

const API_URL = 'https://api.jamendo.com/v3.0/tracks/';
const PAGE_SIZE = 10;

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  duration: number;
  audio: string;
  shareurl: string;
  license_ccurl: string;
  image: string;
}

interface JamendoResponse {
  headers: { status: string; code: number; error_message: string; results_count: number };
  results: JamendoTrack[];
}

/**
 * Catalogue Jamendo (API v3.0, méthode `tracks`) : musique publiée sous licences
 * Creative Commons. Conditions d'utilisation respectées :
 * - usage non commercial gratuit, avec une clé « client_id » personnelle ;
 * - crédit des artistes et de Jamendo, lien de retour vers chaque morceau ;
 * - pas de stockage des fichiers : seul le lien est gardé, l'audio est téléchargé
 *   en mémoire au moment de l'écouter ou de le mixer.
 */
export class JamendoCatalog implements MusicCatalog {
  readonly id = 'jamendo';
  readonly label = 'Jamendo';
  readonly credit = 'Musique fournie par Jamendo, sous licences Creative Commons';
  readonly creditUrl = 'https://www.jamendo.com';

  constructor(private readonly clientId: () => string) {}

  needsKey(): boolean {
    return !this.clientId();
  }

  async search(query: string, page: number, signal: AbortSignal): Promise<CatalogPage> {
    if (this.needsKey()) throw new CatalogError('Renseignez d’abord votre clé client Jamendo.');
    const params = new URLSearchParams({
      client_id: this.clientId(),
      format: 'json',
      limit: String(PAGE_SIZE + 1),
      offset: String((page - 1) * PAGE_SIZE),
      // mp32 : MP3 de meilleure qualité que le format par défaut (mp31, 96 kbit/s).
      audioformat: 'mp32',
      imagesize: '100',
    });
    if (query.trim()) {
      params.set('search', query.trim());
      params.set('boost', 'popularity_total');
    } else {
      params.set('order', 'popularity_week');
    }

    let response: Response;
    try {
      // fetch sans en-tête Authorization : le jeton de l'application n'est jamais envoyé à Jamendo.
      response = await fetch(`${API_URL}?${params}`, { signal, credentials: 'omit' });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new CatalogError('Impossible de joindre Jamendo. Vérifiez votre connexion internet.');
    }
    if (!response.ok) throw new CatalogError(`Jamendo a répondu avec une erreur (HTTP ${response.status}).`);

    const body = (await response.json()) as JamendoResponse;
    if (body.headers.status !== 'success') {
      throw new CatalogError(
        body.headers.code === 5
          ? 'La clé client Jamendo est refusée. Vérifiez-la sur devportal.jamendo.com.'
          : `Jamendo a refusé la recherche : ${body.headers.error_message}`,
      );
    }

    const tracks = body.results.filter((track) => track.audio);
    return {
      page,
      hasMore: tracks.length > PAGE_SIZE,
      results: tracks.slice(0, PAGE_SIZE).map(
        (track): CatalogTrack => ({
          catalogId: this.id,
          externalId: track.id,
          title: track.name,
          artist: track.artist_name,
          audioUrl: track.audio,
          pageUrl: track.shareurl || `https://www.jamendo.com/track/${track.id}`,
          license: licenseLabel(track.license_ccurl),
          licenseUrl: track.license_ccurl || null,
          imageUrl: track.image || null,
          durationSeconds: track.duration || null,
        }),
      ),
    };
  }
}
