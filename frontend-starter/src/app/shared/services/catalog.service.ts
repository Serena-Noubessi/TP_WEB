import { inject, Injectable } from '@angular/core';
import { JamendoCatalog } from '../catalogs/jamendo-catalog';
import { MusicCatalog } from '../catalogs/music-catalog';
import { CatalogKeysService } from './catalog-keys.service';

/**
 * Liste des catalogues de musique libre disponibles.
 * Pour en ajouter un : créer une classe qui implémente MusicCatalog
 * (comme JamendoCatalog) et l'ajouter au tableau ci-dessous.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly keys = inject(CatalogKeysService);

  readonly catalogs: MusicCatalog[] = [new JamendoCatalog(() => this.keys.jamendoClientId())];

  find(id: string): MusicCatalog | undefined {
    return this.catalogs.find((catalog) => catalog.id === id);
  }
}
