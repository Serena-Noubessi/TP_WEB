import { Component, DestroyRef, ElementRef, inject, OnInit, output, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, firstValueFrom, Subject } from 'rxjs';
import { formatDuration, measureDuration } from '../../shared/audio/duration';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { httpMessage } from '../../shared/services/library.service';
import { TrackService } from '../../shared/services/track.service';
import { CoverImageComponent } from '../cover-image/cover-image';
import { IconComponent } from '../icon/icon';

const PER_PAGE = 8;

const VISIBILITY_HINT: Record<string, string> = {
  private: 'Privée : seul ce destinataire y aura accès',
  friends: 'Amis choisis : ce destinataire y aura aussi accès',
  public: 'Publique',
};

/**
 * « Envoyer une de mes pistes » (section 7) : recherche dans MES pistes, avec
 * pochette, titre, durée et pré-écoute. La pré-écoute utilise un lecteur local
 * (le lecteur principal n'est pas interrompu) et s'arrête à la fermeture.
 * Les durées encore inconnues sont mesurées une fois puis enregistrées.
 */
@Component({
  selector: 'app-track-picker',
  imports: [IconComponent, CoverImageComponent],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="backdrop" (click)="close()"></div>
    <section #panel class="dialog" role="dialog" aria-modal="true" aria-labelledby="picker-title" tabindex="-1">
      <header>
        <h2 id="picker-title"><app-icon name="music" /> Envoyer une de mes pistes</h2>
        <button type="button" class="icon-btn" (click)="close()" aria-label="Fermer"><app-icon name="close" /></button>
      </header>
      <label class="search">
        <span class="sr-only">Chercher dans mes pistes</span>
        <app-icon name="search" />
        <input #query type="search" placeholder="Chercher dans mes pistes…" autocomplete="off" (input)="search$.next(query.value)" />
      </label>

      @if (loading()) {
        <p class="state" role="status">Chargement de vos pistes…</p>
      } @else if (error()) {
        <p class="state error" role="alert">{{ error() }} <button type="button" class="link" (click)="load(page())">Réessayer</button></p>
      } @else if (!tracks().length) {
        <p class="state">{{ searchText() ? 'Aucune de vos pistes ne contient « ' + searchText() + ' ».' : 'Vous n’avez encore aucune piste à envoyer.' }}</p>
      } @else {
        <ul class="list">
          @for (track of tracks(); track track.id) {
            @let category = categoryOf(track);
            <li class="row">
              <span class="thumb" [style.--cat]="category.color">
                <app-cover-image [url]="track.coverUrl" [direct]="track.visibility === 'public'" alt="">
                  <app-icon [name]="category.icon" size="1.2rem" />
                </app-cover-image>
              </span>
              <span class="info">
                <strong>{{ displayTitle(track) }}</strong>
                <small>{{ category.label }} · {{ durations()[track.id] === undefined ? formatDuration(track.durationSeconds) : formatDuration(durations()[track.id]) }}</small>
                <small class="vis">{{ visibilityHint[track.visibility ?? 'private'] }}</small>
              </span>
              <button type="button" class="icon-btn" (click)="preview(track)"
                [attr.aria-label]="(previewing() === track.id ? 'Arrêter la pré-écoute de ' : 'Pré-écouter ') + displayTitle(track)">
                <app-icon [name]="previewing() === track.id ? 'pause' : 'play'" />
              </button>
              <button type="button" class="send" (click)="choose(track)">Envoyer</button>
            </li>
          }
        </ul>
        @if (previewError()) { <p class="state error" role="alert">{{ previewError() }}</p> }
        @if (totalPages() > 1) {
          <nav class="pager" aria-label="Pages de mes pistes">
            <button type="button" class="link" [disabled]="page() <= 1" (click)="load(page() - 1)">Précédent</button>
            <span>{{ page() }} / {{ totalPages() }}</span>
            <button type="button" class="link" [disabled]="page() >= totalPages()" (click)="load(page() + 1)">Suivant</button>
          </nav>
        }
      }
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem; }
    .backdrop { position: absolute; inset: 0; background: rgb(24 50 79 / 45%); }
    .dialog {
      position: relative;
      display: grid;
      align-content: start;
      gap: 0.8rem;
      width: min(34rem, 100%);
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      padding: 1.2rem;
      border-radius: 18px;
      background: var(--mv-card);
      box-shadow: var(--mv-shadow);
    }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.15rem; }
    .icon-btn { display: grid; flex: 0 0 auto; width: 2.2rem; height: 2.2rem; padding: 0; place-items: center; border-radius: 50%; color: var(--mv-text); background: var(--mv-control); }
    .icon-btn:hover { color: var(--mv-primary); background: var(--mv-control-hover); }
    .search { display: flex; align-items: center; gap: 0.5rem; padding: 0 0.7rem; border: 1px solid var(--mv-border); border-radius: 10px; background: var(--mv-control); }
    .search input { flex: 1; min-width: 0; border: 0; background: transparent; }
    .list { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
    .row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.55rem; border: 1px solid var(--mv-border); border-radius: 12px; }
    .thumb { display: grid; flex: 0 0 2.8rem; width: 2.8rem; height: 2.8rem; overflow: hidden; place-items: center; border-radius: 10px; color: var(--cat); background: color-mix(in srgb, var(--cat) 16%, var(--mv-card)); }
    .info { display: grid; flex: 1; min-width: 0; }
    .info strong, .info small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .info small { color: var(--mv-muted); font-size: 0.78rem; }
    .info .vis { color: var(--mv-secondary-strong); }
    .send { flex: 0 0 auto; padding: 0.4rem 0.85rem; border-radius: 999px; color: var(--mv-on-accent); background: var(--mv-primary); font-weight: 700; }
    .send:hover { background: var(--mv-primary-strong); }
    .state { margin: 0; padding: 0.6rem; color: var(--mv-muted); }
    .state.error { color: var(--mv-danger-strong); font-weight: 600; }
    .link { padding: 0; border: 0; color: var(--mv-primary); background: none; font-weight: 700; }
    .link:disabled { opacity: 0.4; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 0.8rem; color: var(--mv-muted); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class TrackPickerComponent implements OnInit {
  private readonly trackService = inject(TrackService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly picked = output<Track>();
  readonly closed = output<void>();

  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  readonly formatDuration = formatDuration;
  readonly visibilityHint = VISIBILITY_HINT;

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly searchText = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  /** Durées mesurées pendant cette ouverture (null = impossible à mesurer). */
  readonly durations = signal<Record<string, number | null>>({});
  readonly previewing = signal('');
  readonly previewError = signal('');
  readonly search$ = new Subject<string>();

  private readonly audio = new Audio();
  private audioUrl = '';
  private loadVersion = 0;

  constructor() {
    this.audio.onended = () => this.previewing.set('');
    this.destroyRef.onDestroy(() => {
      this.loadVersion++;
      this.stopPreview();
    });
  }

  ngOnInit(): void {
    queueMicrotask(() => this.panel().nativeElement.focus());
    this.search$.pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe((text) => {
      this.searchText.set(text.trim());
      this.load(1);
    });
    this.load(1);
  }

  load(page: number): void {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set('');
    this.trackService.list(page, PER_PAGE, this.searchText()).subscribe({
      next: (result) => {
        if (version !== this.loadVersion) return;
        const docs = 'docs' in result ? result.docs : result.items;
        this.tracks.set(docs);
        this.page.set(result.page ?? page);
        this.totalPages.set(Math.max(1, 'docs' in result ? result.totalPages : result.pages));
        this.loading.set(false);
        void this.measureMissing(docs, version);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(httpMessage(error, 'Impossible de charger vos pistes.'));
      },
    });
  }

  /**
   * Mesure, une par une, la durée des pistes qui n'en ont pas encore, puis
   * l'enregistre (elle ne sera plus jamais mesurée). S'arrête si la liste change.
   */
  private async measureMissing(tracks: Track[], version: number): Promise<void> {
    for (const track of tracks) {
      if (version !== this.loadVersion) return;
      if (track.durationSeconds || this.durations()[track.id] !== undefined) continue;
      try {
        const blob = await firstValueFrom(this.http.get(`/api/tracks/${track.id}/audio`, { responseType: 'blob' }));
        const seconds = await measureDuration(blob);
        this.durations.update((map) => ({ ...map, [track.id]: seconds }));
        if (seconds) this.trackService.update(track.id, { durationSeconds: seconds }).subscribe({ error: () => undefined });
      } catch (error) {
        console.warn('[TrackPicker] Durée non mesurée', track.id, error);
        this.durations.update((map) => ({ ...map, [track.id]: null }));
      }
    }
  }

  async preview(track: Track): Promise<void> {
    this.previewError.set('');
    if (this.previewing() === track.id) {
      this.stopPreview();
      return;
    }
    this.stopPreview();
    this.previewing.set(track.id);
    try {
      const blob = await firstValueFrom(this.http.get(`/api/tracks/${track.id}/audio`, { responseType: 'blob' }));
      if (this.previewing() !== track.id) return;
      this.audioUrl = URL.createObjectURL(blob);
      this.audio.src = this.audioUrl;
      await this.audio.play();
    } catch (error) {
      console.warn('[TrackPicker] Pré-écoute impossible', error);
      this.previewing.set('');
      this.previewError.set('Pré-écoute impossible. Vous pouvez quand même envoyer la piste.');
    }
  }

  private stopPreview(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = '';
    this.previewing.set('');
  }

  choose(track: Track): void {
    this.stopPreview();
    const measured = this.durations()[track.id];
    this.picked.emit(measured ? { ...track, durationSeconds: measured } : track);
  }

  close(): void {
    this.stopPreview();
    this.closed.emit();
  }
}
