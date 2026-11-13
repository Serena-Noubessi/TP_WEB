import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Track } from '../models/track.model';

/**
 * Nom du fichier indiqué par le serveur dans l'en-tête Content-Disposition
 * (forme UTF-8 « filename*= » en priorité, sinon « filename= »).
 */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* nom mal encodé : on essaie la forme simple */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

/** Message à afficher quand le téléchargement échoue (la réponse d'erreur arrive en Blob, on se fie au code HTTP). */
export function downloadErrorMessage(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 401) return 'Connectez-vous pour télécharger cette piste.';
  if (status === 403) return 'Vous n’avez pas le droit d’écouter cette piste, donc pas de la télécharger.';
  if (status === 404) return 'Cette piste n’existe plus.';
  if (status === 0 || status === 502 || status === 503 || status === 504) return 'Le serveur ne répond pas. Vérifiez votre connexion et réessayez.';
  return 'Téléchargement impossible. Réessayez.';
}

/**
 * Bouton « Télécharger » : le fichier est demandé à l'API avec le jeton de
 * connexion (une simple balise <a> ne l'enverrait pas pour une piste privée),
 * puis enregistré sous le nom donné par le serveur.
 */
@Injectable({ providedIn: 'root' })
export class DownloadService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  async download(track: Pick<Track, 'id' | 'title'>): Promise<void> {
    const response = await firstValueFrom(this.http.get(`/api/tracks/${track.id}/download`, { responseType: 'blob', observe: 'response' }));
    const name = filenameFromDisposition(response.headers.get('Content-Disposition'), `${track.title}.mp3`);
    const url = URL.createObjectURL(response.body!);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
