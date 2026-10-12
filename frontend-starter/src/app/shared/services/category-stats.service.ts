import { inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CATEGORIES, categorySearch } from '../models/category.model';
import { TrackService } from './track.service';

/**
 * Nombre de morceaux par catégorie, calculé avec la route existante
 * GET /api/tracks (paramètre search) : une petite requête (limit=1) par catégorie,
 * dont seul le champ totalDocs est utilisé.
 */
@Injectable({ providedIn: 'root' })
export class CategoryStatsService {
  private readonly tracks = inject(TrackService);

  readonly counts = signal<Record<string, number>>({});
  readonly total = signal<number | null>(null);

  refresh(): void {
    this.tracks.list(1, 1, '').subscribe({
      next: (response) => this.total.set('totalDocs' in response ? response.totalDocs : response.total),
      error: (error: HttpErrorResponse) => console.error('[CategoryStats] Total indisponible', error),
    });
    for (const category of CATEGORIES) {
      this.tracks.list(1, 1, categorySearch(category)).subscribe({
        next: (response) => {
          const count = 'totalDocs' in response ? response.totalDocs : response.total;
          this.counts.update((counts) => ({ ...counts, [category.id]: count }));
        },
        error: (error: HttpErrorResponse) => console.error(`[CategoryStats] Comptage impossible : ${category.label}`, error),
      });
    }
  }
}
