import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DeckId } from '../../shared/models/dj.model';
import { Track } from '../../shared/models/track.model';
import { DjEngineService } from '../../shared/services/dj-engine.service';
import { httpMessage } from '../../shared/services/library.service';
import { MixService } from '../../shared/services/mix.service';
import { OnlineTrackService } from '../../shared/services/online-track.service';
import { PublicService } from '../../shared/services/public.service';
import { IconComponent } from '../icon/icon';
import { MixPublishDialogComponent } from '../mix-publish-dialog/mix-publish-dialog';

/**
 * Barre « Projet » du studio (section 8) :
 * - enregistre l'état du studio comme brouillon en base, et le reprend
 *   (/mix?project=<id>) : pistes rechargées sans démarrer, réglages et positions restaurés ;
 * - charge la piste d'un autre membre pour la remixer (/mix?load=<id>&deck=A) ;
 * - ouvre la publication une fois le mix enregistré.
 */
@Component({
  selector: 'app-mix-project-bar',
  imports: [RouterLink, IconComponent, MixPublishDialogComponent],
  template: `
    <section class="project" aria-label="Projet de mixage">
      <label class="title">
        <span class="label">Projet</span>
        <input type="text" maxlength="120" [value]="title()" (input)="title.set($any($event.target).value)" aria-label="Titre du projet de mixage" />
      </label>
      <span class="status" role="status">
        @if (projectId()) {
          <span class="badge" [class.published]="published()">{{ published() ? 'Publié' : 'Brouillon' }}</span>
        }
        {{ status() }}
      </span>
      <div class="actions">
        <button type="button" class="btn ghost" (click)="save()" [disabled]="busy()"><app-icon name="check" /> {{ projectId() ? 'Enregistrer' : 'Enregistrer le brouillon' }}</button>
        @if (projectId()) {
          <button type="button" class="btn ghost" (click)="startNew()" [disabled]="busy()"><app-icon name="plus" /> Nouveau projet</button>
        }
        <a class="btn ghost" routerLink="/library" [queryParams]="{ tab: 'mixes' }"><app-icon name="folder-open" /> Mes projets</a>
        <button type="button" class="btn primary" (click)="openPublish()" [disabled]="busy() || !engine.recordingBlob()"
          [title]="engine.recordingBlob() ? 'Publier l’enregistrement de votre mix' : 'Enregistrez d’abord votre mix avec « Enregistrer le mix »'">
          <app-icon name="globe" /> Publier…
        </button>
      </div>
      @if (!engine.recordingBlob()) {
        <p class="hint"><app-icon name="info" /> Pour publier : chargez vos pistes, cliquez « Enregistrer le mix », mixez, puis arrêtez l’enregistrement.</p>
      }
      @for (warning of warnings(); track warning) {
        <p class="warning" role="alert"><app-icon name="alert" /> {{ warning }}</p>
      }
      @if (error()) { <p class="warning" role="alert">{{ error() }}</p> }
    </section>

    @if (publishing() && projectId()) {
      <app-mix-publish-dialog [projectId]="projectId()!" [title]="title()" (closed)="publishing.set(false)" (published)="onPublished()" />
    }
  `,
  styles: `
    :host { display: block; }
    .project {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem 1rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--mv-border);
      border-radius: 16px;
      background: var(--mv-card);
    }
    .title { display: flex; flex: 1 1 16rem; align-items: center; gap: 0.6rem; min-width: 0; }
    .label { color: var(--mv-muted); font-size: 0.8rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
    .title input { flex: 1; min-width: 0; font-weight: 700; }
    .status { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--mv-muted); font-size: 0.85rem; }
    .badge { padding: 0.15rem 0.55rem; border-radius: 999px; color: var(--mv-secondary-strong); background: var(--mv-secondary-soft); font-size: 0.75rem; font-weight: 800; }
    .badge.published { color: var(--mv-primary-strong); background: var(--mv-primary-soft); }
    .actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; border: 1px solid transparent; border-radius: 999px; font-size: 0.85rem; font-weight: 700; text-decoration: none; }
    .btn.primary { color: var(--mv-on-accent); background: var(--mv-primary); }
    .btn.primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn.ghost { color: var(--mv-text); border-color: var(--mv-border); background: var(--mv-card); }
    .btn.ghost:hover { background: var(--mv-control-hover); }
    .hint, .warning { display: flex; flex: 1 1 100%; gap: 0.4rem; margin: 0; font-size: 0.85rem; }
    .hint { color: var(--mv-muted); }
    .warning { color: var(--mv-danger-strong); font-weight: 600; }
  `,
})
export class MixProjectBarComponent implements OnInit {
  readonly engine = inject(DjEngineService);
  private readonly mixes = inject(MixService);
  private readonly publicService = inject(PublicService);
  private readonly online = inject(OnlineTrackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = signal<string | null>(null);
  readonly title = signal(this.defaultTitle());
  readonly published = signal(false);
  readonly busy = signal(false);
  readonly status = signal('');
  readonly error = signal('');
  readonly warnings = signal<string[]>([]);
  readonly publishing = signal(false);
  readonly hasProject = computed(() => !!this.projectId());

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const project = params.get('project');
      const load = params.get('load');
      if (project && project !== this.projectId()) void this.restore(project);
      if (load) void this.loadForeign(load, params.get('deck') === 'B' ? 'B' : 'A');
    });
  }

  private defaultTitle(): string {
    return `Mon mix du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  }

  /** Enregistre le brouillon (création ou mise à jour) avec l'état actuel du studio. */
  async save(): Promise<string | null> {
    const title = this.title().trim();
    if (!title) {
      this.error.set('Donnez un titre au projet.');
      return null;
    }
    this.busy.set(true);
    this.error.set('');
    const sources = this.engine.recordedSources();
    const body = { title, state: this.engine.captureState(), sourceTrackIds: sources.tracks, externalIds: sources.external };
    try {
      const id = this.projectId();
      const project = await firstValueFrom(id ? this.mixes.update(id, body) : this.mixes.create(body));
      this.projectId.set(project.id);
      this.published.set(project.status === 'published');
      this.status.set(`enregistré à ${new Date(project.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
      if (!id) void this.router.navigate([], { relativeTo: this.route, queryParams: { project: project.id, load: null, deck: null }, queryParamsHandling: 'merge', replaceUrl: true });
      return project.id;
    } catch (error) {
      this.error.set(httpMessage(error, 'Le brouillon n’a pas pu être enregistré. Réessayez.'));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  /** Reprend un brouillon : pistes rechargées sans démarrer, réglages restaurés. */
  private async restore(id: string): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.warnings.set([]);
    this.status.set('reprise du brouillon…');
    try {
      const project = await firstValueFrom(this.mixes.get(id));
      this.projectId.set(project.id);
      this.title.set(project.title);
      this.published.set(project.status === 'published');
      this.engine.setCrossfader(project.state.crossfader ?? 0);
      this.engine.setMasterVolume(project.state.masterVolume ?? 0.9);
      const warnings: string[] = [];
      await Promise.all(
        (['A', 'B'] as DeckId[]).map(async (deck) => {
          const state = project.state.decks?.[deck];
          if (!state) return;
          const track = await this.findSource(state.source.kind, state.source.id);
          if (!track) {
            warnings.push(`Platine ${deck} : « ${state.title} » n’est plus disponible (supprimée ou accès retiré).`);
            return;
          }
          if (!(await this.engine.restoreDeck(deck, state, track))) warnings.push(`Platine ${deck} : « ${state.title} » n’a pas pu être chargée.`);
        }),
      );
      this.warnings.set(warnings);
      this.status.set('brouillon repris');
    } catch (error) {
      this.error.set(httpMessage(error, 'Ce projet n’existe pas ou ne vous appartient pas.'));
      this.status.set('');
    } finally {
      this.busy.set(false);
    }
  }

  private async findSource(kind: 'track' | 'external', id: string): Promise<Track | null> {
    if (kind === 'external') {
      if (!this.online.tracks().length) await this.online.load();
      return this.online.tracks().find((track) => track.id === id) ?? null;
    }
    try {
      return await firstValueFrom(this.publicService.track(id));
    } catch {
      return null;
    }
  }

  /** Charge la piste d'un autre membre (bouton « Remixer ») sur une platine. */
  private async loadForeign(trackId: string, deck: DeckId): Promise<void> {
    const track = await this.findSource('track', trackId);
    if (!track) {
      this.error.set('Cette piste n’est pas accessible.');
      return;
    }
    this.engine.loadTrack(deck, track, { autoPlay: false });
    this.status.set(`« ${track.title} » chargée sur la platine ${deck}`);
  }

  startNew(): void {
    this.projectId.set(null);
    this.published.set(false);
    this.title.set(this.defaultTitle());
    this.status.set('nouveau projet (non enregistré)');
    this.warnings.set([]);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { project: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Publication : le brouillon est d'abord enregistré avec les pistes entendues dans l'enregistrement. */
  async openPublish(): Promise<void> {
    if (!(await this.save())) return;
    this.publishing.set(true);
  }

  onPublished(): void {
    this.published.set(true);
    this.status.set('publié');
  }
}
