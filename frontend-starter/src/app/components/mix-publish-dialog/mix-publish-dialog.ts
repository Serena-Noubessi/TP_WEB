import { Component, computed, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CATEGORIES } from '../../shared/models/category.model';
import { Track, TrackVisibility } from '../../shared/models/track.model';
import { DjEngineService } from '../../shared/services/dj-engine.service';
import { httpMessage } from '../../shared/services/library.service';
import { MixCheck, MixService, SourceStatus } from '../../shared/services/mix.service';
import { SettingsService } from '../../shared/services/settings.service';
import { IconComponent } from '../icon/icon';
import { ShareDialogComponent } from '../share-dialog/share-dialog';

const STATUS_LABELS: Record<SourceStatus, string> = {
  own: 'Votre piste',
  accepted: 'Autorisation accordée',
  pending: 'Demande envoyée, en attente',
  refused: 'Autorisation refusée',
  none: 'Autorisation nécessaire',
  unavailable: 'Piste indisponible',
};

/**
 * Publication d'un mixage (section 8). Affiche les crédits qui seront figés
 * (« Remix par… », « À partir de la création de… ») et l'état de chaque
 * autorisation ; permet de demander les autorisations manquantes. Le serveur
 * refuse de toute façon une publication sans les autorisations nécessaires.
 */
@Component({
  selector: 'app-mix-publish-dialog',
  imports: [IconComponent, RouterLink, ShareDialogComponent],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="backdrop" (click)="close()"></div>
    <section #panel class="dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title" tabindex="-1">
      <header>
        <h2 id="publish-title"><app-icon name="globe" /> Publier le mixage</h2>
        <button type="button" class="icon-btn" (click)="close()" aria-label="Fermer"><app-icon name="close" /></button>
      </header>

      @if (done(); as track) {
        <div class="success" role="status">
          <app-icon name="check" size="1.6rem" />
          <p><strong>« {{ track.title }} » est publié.</strong> Visibilité : {{ visibilityLabel(track.visibility) }}.</p>
          <div class="row">
            <a class="btn primary" routerLink="/library" [queryParams]="{ tab: 'mixes' }" (click)="close()">Voir mes projets</a>
            @if (track.visibility === 'friends') {
              <button type="button" class="btn ghost" (click)="sharing.set(track)"><app-icon name="users" /> Choisir les amis</button>
            }
          </div>
        </div>
      } @else if (!check()) {
        <p class="state" role="status">{{ checkError() || 'Vérification des crédits et des autorisations…' }}</p>
      } @else {
        @let c = check()!;
        <section aria-labelledby="credits-title">
          <h3 id="credits-title">Crédits (ils ne pourront plus être modifiés)</h3>
          <ul class="sources">
            @for (source of c.sources; track source.trackId) {
              <li [class.ok]="source.status === 'own' || source.status === 'accepted'">
                <span class="info">
                  <strong>{{ source.title }}</strong>
                  <small>{{ source.owner ? 'À partir de la création de ' + source.owner.name : '' }}</small>
                </span>
                <span class="tag" [class]="'tag s-' + source.status">{{ statusLabels[source.status] }}</span>
                @if (source.status === 'none' || source.status === 'refused') {
                  <button type="button" class="btn small primary" (click)="ask(source.trackId)" [disabled]="busy()">Demander l’autorisation</button>
                }
              </li>
            } @empty {
              <li class="empty">Aucune piste MOST VIBE dans ce mix.</li>
            }
            @for (item of c.external; track item.id) {
              <li [class.ok]="!item.blocked">
                <span class="info"><strong>{{ item.title }}</strong><small>{{ item.artist }} · {{ item.license }}</small></span>
                <span class="tag" [class.s-refused]="item.blocked" [class.s-own]="!item.blocked">{{ item.blocked ? 'Licence ND : œuvre dérivée interdite' : 'Licence compatible' }}</span>
              </li>
            }
          </ul>
          @if (askMessage()) { <p class="hint" role="status">{{ askMessage() }}</p> }
        </section>

        @if (!c.publishable) {
          <p class="blocked" role="alert">
            <app-icon name="lock" />
            Publication impossible pour l’instant : chaque piste d’un autre membre doit avoir son autorisation, et aucun morceau sous licence ND ne doit être utilisé.
            Vous pouvez enregistrer le brouillon et revenir plus tard.
          </p>
        } @else {
          <form class="form" (submit)="$event.preventDefault(); publish()">
            <label>Titre <input type="text" maxlength="120" [value]="publishTitle()" (input)="publishTitle.set($any($event.target).value)" /></label>
            <label>Style
              <select [value]="style()" (change)="style.set($any($event.target).value)">
                @for (category of categories; track category.id) { <option [value]="category.id">{{ category.label }}</option> }
              </select>
            </label>
            <label>Visibilité
              <select [value]="visibility()" (change)="visibility.set($any($event.target).value)">
                <option value="private">Privé — visible par moi seulement</option>
                <option value="friends">Amis choisis — je choisis ensuite</option>
                <option value="public">Public — tout le monde, dans Explorer</option>
              </select>
            </label>
            <label>Pochette (facultative) <input type="file" accept="image/jpeg,image/png,image/webp" (change)="chooseCover($event)" /></label>
            <p class="hint">Enregistrement : {{ seconds() }} s · {{ sizeLabel() }}</p>
            @if (progress() !== null) { <progress max="100" [value]="progress()">{{ progress() }} %</progress> }
            <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Publication…' : 'Publier' }}</button>
          </form>
        }
      }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    </section>

    @if (sharing(); as track) {
      <app-share-dialog [track]="track" (closed)="sharing.set(null)" />
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem; }
    .backdrop { position: absolute; inset: 0; background: rgb(24 50 79 / 45%); }
    .dialog { position: relative; display: grid; gap: 0.9rem; width: min(36rem, 100%); max-height: calc(100dvh - 2rem); overflow-y: auto; padding: 1.25rem; border-radius: 18px; background: var(--mv-card); box-shadow: var(--mv-shadow); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.2rem; }
    h3 { margin: 0 0 0.5rem; font-size: 0.95rem; }
    .icon-btn { display: grid; width: 2.2rem; height: 2.2rem; padding: 0; place-items: center; border-radius: 50%; color: var(--mv-text); background: var(--mv-control); }
    .sources { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
    .sources li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem 0.6rem; border: 1px solid var(--mv-border); border-radius: 10px; }
    .sources li.ok { border-color: color-mix(in srgb, var(--mv-success) 40%, var(--mv-border)); }
    .sources .empty { color: var(--mv-muted); }
    .info { display: grid; flex: 1 1 12rem; min-width: 0; }
    .info small { color: var(--mv-muted); }
    .tag { padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800; }
    .s-own, .s-accepted { color: var(--mv-success); background: color-mix(in srgb, var(--mv-success) 12%, var(--mv-card)); }
    .s-pending { color: var(--mv-warning); background: color-mix(in srgb, var(--mv-warning) 12%, var(--mv-card)); }
    .s-refused, .s-none, .s-unavailable { color: var(--mv-danger-strong); background: var(--mv-danger-soft); }
    .blocked { display: flex; gap: 0.5rem; margin: 0; padding: 0.75rem; border-radius: 12px; color: var(--mv-text); background: var(--mv-danger-soft); }
    .form { display: grid; gap: 0.6rem; }
    .form label { display: grid; gap: 0.25rem; font-weight: 600; }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.55rem 1rem; border: 1px solid transparent; border-radius: 999px; font-weight: 700; text-decoration: none; }
    .btn.primary { color: var(--mv-on-accent); background: var(--mv-primary); }
    .btn.ghost { color: var(--mv-text); border-color: var(--mv-border); background: var(--mv-card); }
    .btn.small { padding: 0.3rem 0.7rem; font-size: 0.8rem; }
    .success { display: grid; justify-items: center; gap: 0.6rem; padding: 0.8rem; color: var(--mv-success); text-align: center; }
    .success p { margin: 0; color: var(--mv-text); }
    .hint, .state { margin: 0; color: var(--mv-muted); font-size: 0.85rem; }
    .error { margin: 0; color: var(--mv-danger-strong); font-weight: 600; }
    progress { width: 100%; }
  `,
})
export class MixPublishDialogComponent implements OnInit {
  private readonly mixes = inject(MixService);
  private readonly settings = inject(SettingsService);
  private readonly engine = inject(DjEngineService);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly projectId = input.required<string>();
  readonly title = input('');
  readonly closed = output<void>();
  readonly published = output<Track>();

  readonly categories = CATEGORIES;
  readonly statusLabels = STATUS_LABELS;
  readonly check = signal<MixCheck | null>(null);
  readonly checkError = signal('');
  readonly publishTitle = signal('');
  readonly style = signal('electro');
  readonly visibility = signal<TrackVisibility>('private');
  readonly busy = signal(false);
  readonly progress = signal<number | null>(null);
  readonly error = signal('');
  readonly askMessage = signal('');
  readonly done = signal<Track | null>(null);
  readonly sharing = signal<Track | null>(null);
  private cover?: File;

  readonly seconds = computed(() => this.engine.recordingSeconds());
  readonly sizeLabel = computed(() => {
    const size = this.engine.recordingBlob()?.size ?? 0;
    return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`;
  });

  ngOnInit(): void {
    this.publishTitle.set(this.title());
    queueMicrotask(() => this.panel().nativeElement.focus());
    // Visibilité proposée : celle choisie par défaut dans les paramètres (section 9).
    this.settings.get().subscribe({ next: (settings) => this.visibility.set(settings.privacy.defaultVisibility), error: () => undefined });
    this.loadCheck();
  }

  private loadCheck(): void {
    this.mixes.check(this.projectId()).subscribe({
      next: (check) => this.check.set(check),
      error: (error: unknown) => this.checkError.set(httpMessage(error, 'Vérification impossible.')),
    });
  }

  ask(trackId: string): void {
    this.busy.set(true);
    this.askMessage.set('');
    this.mixes.requestRemix(trackId, 'Je souhaite publier un mixage qui utilise votre piste.').subscribe({
      next: (request) => {
        this.busy.set(false);
        this.askMessage.set(`Demande envoyée à ${request.owner.name}. Vous serez prévenu(e) de sa réponse.`);
        this.loadCheck();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.askMessage.set(httpMessage(error, 'La demande n’a pas pu être envoyée.'));
      },
    });
  }

  chooseCover(event: Event): void {
    this.cover = (event.target as HTMLInputElement).files?.[0];
  }

  publish(): void {
    const recording = this.engine.recordingBlob();
    if (!recording) {
      this.error.set('Aucun enregistrement : utilisez « Enregistrer le mix » dans le studio.');
      return;
    }
    if (!this.publishTitle().trim()) {
      this.error.set('Donnez un titre au mixage.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.mixes
      .publish(this.projectId(), recording, { title: this.publishTitle().trim(), visibility: this.visibility(), style: this.style(), durationSeconds: this.seconds(), cover: this.cover })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) this.progress.set(event.total ? Math.round((event.loaded / event.total) * 100) : null);
          if (event.type !== HttpEventType.Response || !event.body) return;
          this.busy.set(false);
          this.done.set(event.body);
          this.published.emit(event.body);
          if (event.body.visibility === 'friends') this.sharing.set(event.body);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.progress.set(null);
          this.error.set(httpMessage(error, 'La publication a échoué. Réessayez.'));
          this.loadCheck();
        },
      });
  }

  visibilityLabel(value: TrackVisibility | undefined): string {
    return value === 'public' ? 'Public' : value === 'friends' ? 'Amis choisis' : 'Privé';
  }

  close(): void {
    if (this.sharing()) return;
    this.closed.emit();
  }
}
