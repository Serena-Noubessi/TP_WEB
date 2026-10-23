import { httpMessage } from '../../shared/services/library.service';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { readAnalysis } from '../../shared/audio/dj-storage';
import { DeckId, TRACK_DRAG_TYPE } from '../../shared/models/dj.model';
import { Track } from '../../shared/models/track.model';
import { DjEngineService } from '../../shared/services/dj-engine.service';
import { OnlineTrackService } from '../../shared/services/online-track.service';
import { CategoryStatsService } from '../../shared/services/category-stats.service';
import { CATEGORIES, categoryOf, displayTitle, MusicCategory } from '../../shared/models/category.model';
import { TrackService } from '../../shared/services/track.service';
import { IconComponent } from '../icon/icon';

/** Bibliothèque de la table de mixage : les pistes de l'utilisateur, à charger sur une platine. */
@Component({
  selector: 'app-dj-library',
  imports: [IconComponent],
  templateUrl: './dj-library.html',
  styleUrl: './dj-library.css',
})
export class DjLibraryComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  readonly engine = inject(DjEngineService);
  private readonly online = inject(OnlineTrackService);
  readonly stats = inject(CategoryStatsService);
  readonly categories = CATEGORIES;
  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  readonly categoryFilter = signal('');

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;

  /** Même liste que l'onglet Backing tracks : les morceaux en ligne en tête de la première page. */
  readonly displayed = computed(() => {
    const category = this.categoryFilter();
    const inCategory = (track: Track) => !category || categoryOf(track).id === category;
    const online = this.page() === 1 ? this.online.filtered(this.search()).filter(inCategory) : [];
    return [...online, ...this.tracks().filter(inCategory)];
  });

  constructor() {
    this.load();
    this.stats.refresh();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    // Texte et style filtrés par le backend (paramètres search et style).
    this.service.list(this.page(), 8, this.search().trim(), this.categoryFilter()).subscribe({
      next: (response) => {
        const docs = 'docs' in response ? response.docs : response.items;
        const totalPages = 'totalPages' in response ? response.totalPages : response.pages;
        this.tracks.set(Array.isArray(docs) ? docs : []);
        this.pages.set(Math.max(1, totalPages));
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[DjLibrary] Chargement impossible', error);
        this.error.set(httpMessage(error, 'Le chargement de la bibliothèque a échoué. Réessayez avec « Actualiser ».'));
        this.loading.set(false);
      },
    });
  }

  filter(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 250);
  }

  selectCategory(id: string): void {
    this.categoryFilter.set(this.categoryFilter() === id ? '' : id);
    this.page.set(1);
    this.load();
  }

  categoryCount(category: MusicCategory): number | null {
    const server = this.stats.counts()[category.id];
    return server === undefined ? null : server + this.online.tracks().filter((track) => categoryOf(track).id === category.id).length;
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  loadOn(id: DeckId, track: Track): void {
    this.engine.loadTrack(id, track);
  }

  dragStart(event: DragEvent, track: Track): void {
    event.dataTransfer?.setData(TRACK_DRAG_TYPE, JSON.stringify(track));
    event.dataTransfer?.setData('text/plain', track.title);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  /** BPM déjà connu (morceau analysé lors d'un chargement précédent). */
  knownBpm(track: Track): string {
    const analysis = readAnalysis(track.id);
    return analysis ? `${analysis.bpm.toFixed(1)} BPM` : '';
  }

  isOnDeck(id: DeckId, track: Track): boolean {
    return this.engine.deck(id).track()?.id === track.id;
  }
}
