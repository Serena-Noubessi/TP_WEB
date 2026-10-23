import { Component, computed, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { displayTitle } from '../../shared/models/category.model';
import { Track, TrackVisibility } from '../../shared/models/track.model';
import { AccessGrant, httpMessage, LibraryService, UserSummary } from '../../shared/services/library.service';
import { SocialService } from '../../shared/services/social.service';
import { TrackService } from '../../shared/services/track.service';
import { IconComponent } from '../icon/icon';

const VISIBILITY_OPTIONS: { value: TrackVisibility; label: string; help: string; icon: 'lock' | 'users' | 'globe' }[] = [
  { value: 'private', label: 'Privé', help: 'Vous seul pouvez écouter cette piste.', icon: 'lock' },
  { value: 'friends', label: 'Amis choisis', help: 'Seuls les amis que vous choisissez ci-dessous.', icon: 'users' },
  { value: 'public', label: 'Public', help: 'Tout le monde, même sans compte. Visible dans Explorer.', icon: 'globe' },
];

/**
 * Section 5 : visibilité d'une piste et personnes qui y ont accès.
 * Le propriétaire peut changer la visibilité, donner accès à des amis choisis
 * (section 6 : seulement parmi ses amis), voir qui a accès et retirer un accès.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [IconComponent, RouterLink],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="backdrop" (click)="close()"></div>
    <section #panel class="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" tabindex="-1">
      <header>
        <h2 id="share-title"><app-icon name="share" /> Visibilité et partage</h2>
        <button type="button" class="icon-btn" (click)="close()" aria-label="Fermer"><app-icon name="close" /></button>
      </header>
      <p class="subtitle">« {{ title() }} »</p>

      <fieldset class="visibility">
        <legend>Qui peut écouter cette piste ?</legend>
        @for (option of options; track option.value) {
          <label class="option" [class.selected]="visibility() === option.value">
            <input type="radio" name="share-visibility" [value]="option.value" [checked]="visibility() === option.value"
              (change)="askVisibility(option.value)" [disabled]="busy()" />
            <app-icon [name]="option.icon" />
            <span><strong>{{ option.label }}</strong><small>{{ option.help }}</small></span>
          </label>
        }
      </fieldset>

      @if (confirmPrivate()) {
        <div class="confirm" role="alertdialog" aria-labelledby="confirm-private">
          <p id="confirm-private">
            Repasser en <strong>Privé</strong> retire l’accès des {{ activeShares().length }} personne(s) choisie(s).
            Un fichier qu’elles auraient déjà téléchargé ne peut pas être récupéré à distance.
          </p>
          <div class="row">
            <button type="button" class="danger" (click)="setVisibility('private')">Repasser en Privé</button>
            <button type="button" class="secondary" (click)="confirmPrivate.set(false)">Annuler</button>
          </div>
        </div>
      }

      <section class="people" aria-labelledby="people-title">
        <h3 id="people-title">Personnes qui ont accès</h3>
        @if (visibility() === 'public') {
          <p class="hint"><app-icon name="info" /> La piste est publique : tout le monde peut l’écouter. Les accès ci-dessous comptent si vous la repassez en « Amis choisis ».</p>
        }

        @if (friendsLoaded() && !friends().length) {
          <p class="hint"><app-icon name="info" /> Vous n’avez pas encore d’amis. « Amis choisis » ne peut viser que vos amis : <a routerLink="/friends" [queryParams]="{ tab: 'find' }" (click)="close()">trouver des amis</a>.</p>
        } @else {
          <label class="search">
            <span class="sr-only">Filtrer mes amis par nom</span>
            <app-icon name="search" />
            <input #searchInput type="search" placeholder="Ajouter un ami (filtrer par nom)…" autocomplete="off" (input)="filter.set(searchInput.value)" [disabled]="busy()" />
          </label>
          @if (candidates().length) {
            <ul class="results" aria-label="Amis sans accès">
              @for (user of candidates(); track user.id) {
                <li>
                  <span class="avatar" aria-hidden="true">{{ user.name.charAt(0).toUpperCase() }}</span>
                  <span class="name">{{ user.name }}</span>
                  <button type="button" class="small" (click)="grant(user); searchInput.value = ''; filter.set('')" [disabled]="busy()"><app-icon name="user-plus" /> Donner accès</button>
                </li>
              }
            </ul>
          } @else if (friendsLoaded() && filter().trim()) {
            <p class="hint">Aucun ami sans accès ne correspond à « {{ filter().trim() }} ».</p>
          }
        }

        @if (loading()) {
          <p class="hint">Chargement des accès…</p>
        } @else {
          <ul class="grants">
            @for (grant of grants(); track grant.user.id) {
              <li [class.revoked]="!grant.active">
                <span class="avatar" aria-hidden="true">{{ grant.user.name.charAt(0).toUpperCase() }}</span>
                <span class="name">
                  {{ grant.user.name }}
                  <small>
                    {{ grant.via === 'message' ? 'Envoyée par message' : 'Choisie' }} le {{ date(grant.grantedAt) }}
                    @if (!grant.active) { — accès retiré le {{ date(grant.revokedAt!) }} }
                  </small>
                </span>
                @if (grant.active) {
                  @if (confirmRevoke() === grant.user.id) {
                    <span class="row">
                      <button type="button" class="small danger" (click)="revoke(grant)">Confirmer le retrait</button>
                      <button type="button" class="small secondary" (click)="confirmRevoke.set('')">Annuler</button>
                    </span>
                  } @else {
                    <button type="button" class="small secondary" (click)="confirmRevoke.set(grant.user.id)" [disabled]="busy()">Retirer l’accès</button>
                  }
                } @else {
                  <span class="tag">Retiré</span>
                }
              </li>
            } @empty {
              <li class="empty"><app-icon name="users" /> Personne d’autre n’a accès pour l’instant. Choisissez un ami ci-dessus pour partager cette piste.</li>
            }
          </ul>
        }
      </section>

      @if (notice()) {
        <p class="notice" [class.warning]="noticeIsWarning()" role="status"><app-icon [name]="noticeIsWarning() ? 'alert' : 'check'" /> {{ notice() }}</p>
      }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem; }
    .backdrop { position: absolute; inset: 0; background: rgb(24 50 79 / 45%); }
    .dialog {
      position: relative;
      display: grid;
      gap: 0.9rem;
      width: min(34rem, 100%);
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      padding: 1.25rem;
      border-radius: 18px;
      background: var(--mv-card);
      box-shadow: var(--mv-shadow);
    }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.2rem; }
    h3 { margin: 0 0 0.5rem; font-size: 1rem; }
    .subtitle { margin: -0.6rem 0 0; color: var(--mv-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .icon-btn { display: grid; place-items: center; padding: 0.4rem; border-radius: 50%; color: var(--mv-text); background: var(--mv-control); }
    fieldset { display: grid; gap: 0.45rem; margin: 0; padding: 0; border: 0; }
    legend { margin-bottom: 0.4rem; font-weight: 700; }
    .option {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--mv-border);
      border-radius: 12px;
      cursor: pointer;
    }
    .option.selected { border-color: var(--mv-primary); background: var(--mv-primary-soft); }
    .option input { margin: 0; accent-color: var(--mv-primary); }
    .option span { display: grid; }
    .option small { color: var(--mv-muted); }
    .confirm { padding: 0.8rem; border: 1px solid var(--mv-danger); border-radius: 12px; background: var(--mv-danger-soft); }
    .confirm p { margin: 0 0 0.6rem; }
    .row { display: inline-flex; flex-wrap: wrap; gap: 0.4rem; }
    .search { display: flex; align-items: center; gap: 0.5rem; padding: 0 0.7rem; border: 1px solid var(--mv-border); border-radius: 10px; background: var(--mv-control); }
    .search input { flex: 1; min-width: 0; border: 0; background: transparent; }
    .results, .grants { display: grid; gap: 0.35rem; margin: 0.5rem 0 0; padding: 0; list-style: none; }
    .results li, .grants li { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.55rem; border-radius: 10px; background: var(--mv-inset); }
    .grants li.revoked { opacity: 0.65; }
    .grants li.empty { color: var(--mv-muted); }
    .avatar { display: grid; flex: 0 0 2rem; height: 2rem; place-items: center; border-radius: 50%; color: var(--mv-on-accent); background: var(--mv-secondary-strong); font-weight: 800; }
    .name { display: grid; flex: 1; min-width: 0; font-weight: 600; }
    .name small { color: var(--mv-muted); font-weight: 400; }
    .tag { padding: 0.15rem 0.5rem; border-radius: 999px; color: var(--mv-muted); background: var(--mv-control); font-size: 0.75rem; font-weight: 700; }
    button.small { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.65rem; font-size: 0.8rem; }
    button.secondary { color: var(--mv-text); background: var(--mv-control); border: 1px solid var(--mv-border); }
    button.danger { color: var(--mv-on-accent); background: var(--mv-danger); }
    .hint { display: flex; gap: 0.4rem; margin: 0.4rem 0; color: var(--mv-muted); font-size: 0.85rem; }
    .notice { display: flex; gap: 0.5rem; margin: 0; padding: 0.7rem 0.8rem; border-radius: 10px; color: var(--mv-text); background: var(--mv-primary-soft); }
    .notice.warning { background: color-mix(in srgb, var(--mv-warning) 14%, var(--mv-card)); }
    .error { margin: 0; color: var(--mv-danger-strong); font-weight: 600; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class ShareDialogComponent implements OnInit {
  private readonly library = inject(LibraryService);
  private readonly tracks = inject(TrackService);
  private readonly social = inject(SocialService);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly track = input.required<Track>();
  /** Émis quand la visibilité change (pour mettre à jour la liste appelante). */
  readonly changed = output<Track>();
  readonly closed = output<void>();

  readonly options = VISIBILITY_OPTIONS;
  readonly title = computed(() => displayTitle(this.track()));
  readonly visibility = signal<TrackVisibility>('private');
  readonly grants = signal<AccessGrant[]>([]);
  readonly activeShares = computed(() => this.grants().filter((grant) => grant.active && grant.via === 'share'));
  /** Mes amis (seules personnes possibles pour « Amis choisis »). */
  readonly friends = signal<UserSummary[]>([]);
  readonly friendsLoaded = signal(false);
  readonly filter = signal('');
  /** Amis sans accès actif, filtrés par nom (5 au maximum sans filtre). */
  readonly candidates = computed(() => {
    const needle = this.filter().trim().toLowerCase();
    const list = this.friends().filter((user) => !this.hasActive(user.id) && (!needle || user.name.toLowerCase().includes(needle)));
    return needle ? list : list.slice(0, 5);
  });
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly confirmPrivate = signal(false);
  readonly confirmRevoke = signal('');
  readonly notice = signal('');
  /** Les messages de retrait d'accès sont des avertissements ; les autres, des confirmations. */
  readonly noticeIsWarning = computed(() => /retiré/i.test(this.notice()));
  readonly error = signal('');

  ngOnInit(): void {
    this.visibility.set(this.track().visibility ?? 'private');
    queueMicrotask(() => this.panel().nativeElement.focus());
    this.library.access(this.track().id).subscribe({
      next: (list) => {
        this.grants.set(list.grants);
        this.visibility.set(list.visibility);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(httpMessage(error, 'Impossible de charger la liste des accès.'));
      },
    });
    this.social.friends().subscribe({
      next: ({ friends }) => {
        this.friends.set(friends.map((link) => link.user));
        this.friendsLoaded.set(true);
      },
      error: (error: unknown) => {
        this.friendsLoaded.set(true);
        this.error.set(httpMessage(error, 'Impossible de charger vos amis.'));
      },
    });
  }

  hasActive(userId: string): boolean {
    return this.grants().some((grant) => grant.user.id === userId && grant.active);
  }

  askVisibility(value: TrackVisibility): void {
    if (value === 'private' && this.activeShares().length) {
      this.confirmPrivate.set(true);
      return;
    }
    this.setVisibility(value);
  }

  setVisibility(value: TrackVisibility): void {
    this.confirmPrivate.set(false);
    this.busy.set(true);
    this.error.set('');
    const previous = this.visibility();
    this.visibility.set(value);
    this.tracks.update(this.track().id, { visibility: value }).subscribe({
      next: (updated) => {
        this.busy.set(false);
        const revoked = (updated as Track & { revokedAccesses?: number }).revokedAccesses ?? 0;
        if (revoked) {
          this.grants.update((list) => list.map((grant) => (grant.via === 'share' && grant.active ? { ...grant, active: false, revokedAt: new Date().toISOString() } : grant)));
          this.notice.set(`${revoked} accès retiré(s). Un fichier déjà téléchargé ne peut pas être récupéré à distance.`);
        }
        this.changed.emit({ ...this.track(), visibility: updated.visibility });
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.visibility.set(previous);
        this.error.set(httpMessage(error, 'La visibilité n’a pas pu être modifiée.'));
      },
    });
  }

  grant(user: UserSummary): void {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.library.grant(this.track().id, [user.id]).subscribe({
      next: (list) => {
        this.busy.set(false);
        this.grants.set(list.grants);
        if (list.visibility !== this.visibility()) {
          this.visibility.set(list.visibility);
          this.changed.emit({ ...this.track(), visibility: list.visibility });
        }
        this.notice.set(`${user.name} peut maintenant écouter cette piste.`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(httpMessage(error, 'L’accès n’a pas pu être donné.'));
      },
    });
  }

  revoke(grant: AccessGrant): void {
    this.busy.set(true);
    this.error.set('');
    this.confirmRevoke.set('');
    this.library.revoke(this.track().id, grant.user.id).subscribe({
      next: (list) => {
        this.busy.set(false);
        this.grants.set(list.grants);
        this.notice.set(list.notice ?? 'Accès retiré.');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(httpMessage(error, 'L’accès n’a pas pu être retiré.'));
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  date(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
