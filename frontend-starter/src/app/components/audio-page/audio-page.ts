import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CATEGORIES, categoryOf, categorySearch, displayTitle, findCategory, MusicCategory } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { AudioPlayerService, MAX_RATE, MIN_RATE } from '../../shared/services/audio-player.service';
import { CategoryStatsService } from '../../shared/services/category-stats.service';
import { OnlineTrackService } from '../../shared/services/online-track.service';
import { TrackService } from '../../shared/services/track.service';
import { DjVisualizerComponent, VisualizerAudioSource } from '../dj-visualizer/dj-visualizer';
import { IconComponent } from '../icon/icon';

const PAGE_SIZE = 10;

/** Onglet « Audio » : écoute simple avec visuels Butterchurn, vitesse, volume et lecture en arrière-plan. */
@Component({
  imports: [DjVisualizerComponent, IconComponent],
  templateUrl: './audio-page.html',
  styleUrl: './audio-page.css',
  host: { '(document:keydown)': 'shortcut($event)' },
})
export class AudioPageComponent implements OnDestroy {
  readonly player = inject(AudioPlayerService);
  private readonly service = inject(TrackService);
  private readonly online = inject(OnlineTrackService);
  readonly stats = inject(CategoryStatsService);

  readonly categories = CATEGORIES;
  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  readonly minRate = MIN_RATE;
  readonly maxRate = MAX_RATE;
  readonly ratePresets = [0.75, 1, 1.25, 1.5];
  readonly visualSource: VisualizerAudioSource = () => this.player.visualSource();

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly search = signal('');
  readonly categoryFilter = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly displayed = computed(() => {
    const category = this.categoryFilter();
    const inCategory = (track: Track) => !category || categoryOf(track).id === category;
    const online = this.page() === 1 ? this.online.filtered(this.search()).filter(inCategory) : [];
    return [...online, ...this.tracks().filter(inCategory)];
  });
  readonly progress = computed(() => (this.player.duration() ? (this.player.time() / this.player.duration()) * 100 : 0));

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
    const category = findCategory(this.categoryFilter());
    const search = this.search().trim() || (category ? categorySearch(category) : '');
    this.service.list(this.page(), PAGE_SIZE, search).subscribe({
      next: (response) => {
        const docs = 'docs' in response ? response.docs : response.items;
        this.tracks.set(Array.isArray(docs) ? docs : []);
        this.pages.set(Math.max(1, 'totalPages' in response ? response.totalPages : response.pages));
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AudioPage] Chargement impossible', error);
        this.error.set(error.status === 0 ? 'Impossible de joindre l’API.' : 'Le chargement des morceaux a échoué.');
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

  /** Lit le morceau choisi ; la suite de la liste affichée devient la file d'attente. */
  play(index: number): void {
    const track = this.displayed()[index];
    if (this.isCurrent(track)) {
      this.player.togglePlay();
      return;
    }
    this.player.playList(this.displayed(), index);
  }

  isCurrent(track: Track): boolean {
    return this.player.current()?.id === track.id;
  }

  seek(event: Event): void {
    this.player.seek((Number((event.target as HTMLInputElement).value) / 100) * this.player.duration());
  }

  changeRate(event: Event): void {
    this.player.setRate(Number((event.target as HTMLInputElement).value));
  }

  changeVolume(event: Event): void {
    this.player.setVolume(Number((event.target as HTMLInputElement).value));
  }

  changePitch(event: Event): void {
    this.player.setPreservePitch((event.target as HTMLInputElement).checked);
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  /** Espace : lecture/pause ; flèches : ±5 secondes (sauf pendant une saisie). */
  shortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, select, textarea, button, [role="slider"]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === ' ') {
      event.preventDefault();
      this.player.togglePlay();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.player.seek(this.player.time() + (event.key === 'ArrowRight' ? 5 : -5));
    }
  }
}
