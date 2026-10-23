import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CATEGORIES } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { PublicSearch, PublicService } from '../../shared/services/public.service';
import { IconComponent } from '../icon/icon';
import { TrackTileComponent } from '../track-tile/track-tile';

const PAGE_SIZE = 18;

/**
 * Explorer et rechercher les contenus publics (accessible sans compte).
 * Les filtres sont reflétés dans l'adresse (?q=…&style=…) : une recherche peut être partagée.
 */
@Component({
  imports: [ReactiveFormsModule, IconComponent, TrackTileComponent],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.css',
})
export class ExplorePageComponent {
  private readonly service = inject(PublicService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly player = inject(AudioPlayerService);
  readonly categories = CATEGORIES;

  readonly form = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    author: new FormControl('', { nonNullable: true }),
    album: new FormControl('', { nonNullable: true }),
    tag: new FormControl('', { nonNullable: true }),
    sort: new FormControl<'recent' | 'title'>('recent', { nonNullable: true }),
  });
  readonly style = signal('');
  readonly kind = signal<'' | 'track' | 'mix'>('');
  readonly page = signal(1);
  readonly showFilters = signal(false);

  readonly results = signal<Track[]>([]);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    const subscription = this.route.queryParamMap.subscribe((params) => {
      this.form.setValue(
        {
          q: params.get('q') ?? '',
          author: params.get('author') ?? '',
          album: params.get('album') ?? '',
          tag: params.get('tag') ?? '',
          sort: params.get('sort') === 'title' ? 'title' : 'recent',
        },
        { emitEvent: false },
      );
      this.style.set(params.get('style') ?? '');
      const kind = params.get('kind');
      this.kind.set(kind === 'track' || kind === 'mix' ? kind : '');
      this.page.set(Math.max(1, Number(params.get('page')) || 1));
      if (params.get('author') || params.get('album') || params.get('tag')) this.showFilters.set(true);
      this.load();
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  submit(event: Event): void {
    event.preventDefault();
    this.navigate({ page: 1 });
  }

  selectStyle(id: string): void {
    this.style.set(this.style() === id ? '' : id);
    this.navigate({ page: 1 });
  }

  selectKind(kind: '' | 'track' | 'mix'): void {
    this.kind.set(kind);
    this.navigate({ page: 1 });
  }

  go(page: number): void {
    this.navigate({ page });
  }

  reset(): void {
    this.form.reset({ q: '', author: '', album: '', tag: '', sort: 'recent' });
    this.style.set('');
    this.kind.set('');
    this.navigate({ page: 1 });
  }

  play(index: number): void {
    const track = this.results()[index];
    if (this.player.current()?.id === track.id) this.player.togglePlay();
    else this.player.playList(this.results(), index);
  }

  activeFilters(): boolean {
    const value = this.form.getRawValue();
    return !!(value.q || value.author || value.album || value.tag || this.style() || this.kind());
  }

  private navigate({ page }: { page: number }): void {
    const value = this.form.getRawValue();
    const queryParams: Record<string, string | number | null> = {
      q: value.q.trim() || null,
      author: value.author.trim() || null,
      album: value.album.trim() || null,
      tag: value.tag.trim() || null,
      sort: value.sort === 'title' ? 'title' : null,
      style: this.style() || null,
      kind: this.kind() || null,
      page: page > 1 ? page : null,
    };
    void this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  private load(): void {
    const value = this.form.getRawValue();
    const query: PublicSearch = { ...value, style: this.style(), kind: this.kind(), page: this.page(), limit: PAGE_SIZE };
    this.loading.set(true);
    this.error.set('');
    this.service.search(query).subscribe({
      next: (page) => {
        this.results.set(page.docs);
        this.total.set(page.totalDocs);
        this.pages.set(Math.max(1, page.totalPages));
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[ExplorePage] Recherche impossible', error);
        const message = typeof error.error?.message === 'string' ? error.error.message : '';
        this.error.set(error.status === 0 || error.status === 502 ? 'Le serveur ne répond pas. Réessayez dans un instant.' : message || 'La recherche a échoué.');
        this.loading.set(false);
      },
    });
  }
}
