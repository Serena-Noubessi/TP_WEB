import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'gpc_jamendo_client_id';
const CONFIG_URL = '/catalogs.local.json';

/**
 * Clés des catalogues en ligne. Elles ne sont jamais écrites dans le code source :
 * - soit dans `public/catalogs.local.json`, fichier ignoré par Git (voir `.gitignore`) ;
 * - soit saisies dans l'application et gardées dans ce navigateur (localStorage).
 * Attention : une clé utilisée par le navigateur reste visible dans ses requêtes
 * réseau. Pour la cacher complètement, il faudrait un serveur intermédiaire.
 */
@Injectable({ providedIn: 'root' })
export class CatalogKeysService {
  readonly jamendoClientId = signal(this.readStored());
  private configLoaded?: Promise<void>;

  /** Lit le fichier local de configuration une seule fois, à la première recherche. */
  load(): Promise<void> {
    this.configLoaded ??= (async () => {
      if (this.jamendoClientId()) return;
      try {
        const response = await fetch(CONFIG_URL, { cache: 'no-store' });
        if (!response.ok) return;
        const config = (await response.json()) as { jamendoClientId?: unknown };
        if (typeof config.jamendoClientId === 'string' && config.jamendoClientId.trim()) {
          this.jamendoClientId.set(config.jamendoClientId.trim());
        }
      } catch {
        // Fichier absent ou invalide : la clé pourra être saisie dans l'application.
      }
    })();
    return this.configLoaded;
  }

  saveJamendoClientId(value: string): void {
    const clean = value.trim();
    this.jamendoClientId.set(clean);
    try {
      if (clean) localStorage.setItem(STORAGE_KEY, clean);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('[CatalogKeys] Enregistrement impossible', error);
    }
  }

  private readStored(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }
}
