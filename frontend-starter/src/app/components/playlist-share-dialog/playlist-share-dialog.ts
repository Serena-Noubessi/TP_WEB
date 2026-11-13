import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { httpMessage, LibraryService, Playlist, PlaylistVisibility, UserSummary } from '../../shared/services/library.service';
import { SocialService } from '../../shared/services/social.service';
import { IconComponent } from '../icon/icon';

const VISIBILITY_OPTIONS: { value: PlaylistVisibility; label: string; help: string; icon: 'lock' | 'users' | 'globe' }[] = [
  { value: 'private', label: 'Privée', help: 'Vous seul la voyez.', icon: 'lock' },
  { value: 'friends', label: 'Amis choisis', help: 'Seuls les amis choisis ci-dessous la voient.', icon: 'users' },
  { value: 'public', label: 'Publique', help: 'Tout le monde peut l’ouvrir avec son lien, et elle apparaît sur votre profil.', icon: 'globe' },
];

/**
 * Partage d'une playlist : visibilité, amis qui y ont accès, lien à copier.
 * Partager une playlist ne donne pas accès aux pistes privées qu'elle contient :
 * chacun n'y voit que les pistes qu'il a déjà le droit d'écouter.
 */
@Component({
  selector: 'app-playlist-share-dialog',
  imports: [IconComponent, RouterLink],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section #panel class="dialog" role="dialog" aria-modal="true" aria-labelledby="pl-share-title" tabindex="-1">
      <header>
        <h2 id="pl-share-title"><app-icon name="share" /> Partager la playlist</h2>
        <button type="button" class="icon-btn" (click)="closed.emit()" aria-label="Fermer"><app-icon name="close" /></button>
      </header>
      <p class="subtitle">« {{ playlist().name }} »</p>

      <fieldset>
        <legend>Qui peut voir cette playlist ?</legend>
        @for (option of options; track option.value) {
          <label class="option" [class.selected]="visibility() === option.value">
            <input type="radio" name="pl-visibility" [value]="option.value" [checked]="visibility() === option.value" (change)="setVisibility(option.value)" [disabled]="busy()" />
            <app-icon [name]="option.icon" />
            <span><strong>{{ option.label }}</strong><small>{{ option.help }}</small></span>
          </label>
        }
      </fieldset>

      @if (visibility() !== 'private') {
        <div class="link-row">
          <input type="text" readonly [value]="link()" aria-label="Lien de la playlist" (focus)="$any($event.target).select()" />
          <button type="button" class="small secondary" (click)="copy()"><app-icon name="link" /> Copier le lien</button>
        </div>
      }

      <section aria-labelledby="pl-people-title">
        <h3 id="pl-people-title">Amis qui ont accès</h3>
        @if (friendsLoaded() && !friends().length) {
          <p class="hint"><app-icon name="info" /> Vous n’avez pas encore d’amis : <a routerLink="/friends" [queryParams]="{ tab: 'find' }" (click)="closed.emit()">trouver des amis</a>.</p>
        } @else if (candidates().length) {
          <ul class="list" aria-label="Amis sans accès">
            @for (user of candidates(); track user.id) {
              <li>
                <span class="avatar" aria-hidden="true">{{ user.name.charAt(0).toUpperCase() }}</span>
                <span class="name">{{ user.name }}</span>
                <button type="button" class="small" (click)="share(user)" [disabled]="busy()"><app-icon name="user-plus" /> Partager</button>
              </li>
            }
          </ul>
        }
        <ul class="list granted">
          @for (user of sharedWith(); track user.id) {
            <li>
              <span class="avatar" aria-hidden="true">{{ user.name.charAt(0).toUpperCase() }}</span>
              <span class="name">{{ user.name }}</span>
              <button type="button" class="small secondary" (click)="unshare(user)" [disabled]="busy()">Retirer</button>
            </li>
          } @empty {
            @if (loaded()) { <li class="empty">Aucun ami n’a encore accès à cette playlist.</li> }
          }
        </ul>
        <p class="hint"><app-icon name="info" /> Vos amis n’y verront que les pistes qu’ils ont déjà le droit d’écouter.</p>
      </section>

      @if (notice()) { <p class="notice" role="status"><app-icon name="check" /> {{ notice() }}</p> }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem; }
    .backdrop { position: absolute; inset: 0; background: rgb(24 50 79 / 45%); }
    .dialog { position: relative; display: grid; gap: 0.9rem; width: min(32rem, 100%); max-height: calc(100dvh - 2rem); overflow-y: auto; padding: 1.25rem; border-radius: 18px; background: var(--mv-card); box-shadow: var(--mv-shadow); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.2rem; }
    h3 { margin: 0 0 0.5rem; font-size: 1rem; }
    .subtitle { margin: -0.6rem 0 0; overflow: hidden; color: var(--mv-muted); text-overflow: ellipsis; white-space: nowrap; }
    .icon-btn { display: grid; place-items: center; padding: 0.4rem; border-radius: 50%; color: var(--mv-text); background: var(--mv-control); }
    fieldset { display: grid; gap: 0.45rem; margin: 0; padding: 0; border: 0; }
    legend { margin-bottom: 0.4rem; font-weight: 700; }
    .option { display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.75rem; border: 1px solid var(--mv-border); border-radius: 12px; cursor: pointer; }
    .option.selected { border-color: var(--mv-primary); background: var(--mv-primary-soft); }
    .option input { margin: 0; accent-color: var(--mv-primary); }
    .option span { display: grid; }
    .option small { color: var(--mv-muted); }
    .link-row { display: flex; gap: 0.4rem; }
    .link-row input { flex: 1; min-width: 0; font-size: 0.85rem; }
    .list { display: grid; gap: 0.35rem; margin: 0 0 0.5rem; padding: 0; list-style: none; }
    .list li { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.55rem; border-radius: 10px; background: var(--mv-inset); }
    .list li.empty { color: var(--mv-muted); }
    .granted li { border: 1px solid color-mix(in srgb, var(--mv-primary) 30%, var(--mv-border)); }
    .avatar { display: grid; flex: 0 0 2rem; height: 2rem; place-items: center; border-radius: 50%; color: var(--mv-on-accent); background: var(--mv-secondary-strong); font-weight: 800; }
    .name { flex: 1; min-width: 0; overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    button.small { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.65rem; font-size: 0.8rem; }
    button.secondary { color: var(--mv-text); background: var(--mv-control); border: 1px solid var(--mv-border); }
    .hint { display: flex; gap: 0.4rem; margin: 0.4rem 0 0; color: var(--mv-muted); font-size: 0.85rem; }
    .notice { display: flex; gap: 0.5rem; margin: 0; padding: 0.7rem 0.8rem; border-radius: 10px; background: var(--mv-primary-soft); }
    .error { margin: 0; color: var(--mv-danger-strong); font-weight: 600; }
  `,
})
export class PlaylistShareDialogComponent implements OnInit {
  private readonly library = inject(LibraryService);
  private readonly social = inject(SocialService);
  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly playlist = input.required<Playlist>();
  /** Émis après chaque modification (visibilité ou nombre de partages). */
  readonly changed = output<Playlist>();
  readonly closed = output<void>();

  readonly options = VISIBILITY_OPTIONS;
  readonly visibility = signal<PlaylistVisibility>('private');
  readonly sharedWith = signal<UserSummary[]>([]);
  readonly friends = signal<UserSummary[]>([]);
  readonly friendsLoaded = signal(false);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly error = signal('');
  /** Amis qui n'ont pas encore accès. */
  readonly candidates = computed(() => this.friends().filter((user) => !this.sharedWith().some((shared) => shared.id === user.id)));
  readonly link = computed(() => `${this.document.location.origin}/p/${this.playlist().id}`);

  ngOnInit(): void {
    this.visibility.set(this.playlist().visibility);
    queueMicrotask(() => this.panel().nativeElement.focus());
    this.library.playlist(this.playlist().id).subscribe({
      next: (detail) => {
        this.sharedWith.set(detail.sharedWith ?? []);
        this.visibility.set(detail.visibility);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loaded.set(true);
        this.error.set(httpMessage(error, 'Impossible de charger les accès.'));
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

  setVisibility(value: PlaylistVisibility): void {
    const previous = this.visibility();
    this.visibility.set(value);
    this.run(this.library.updatePlaylist(this.playlist().id, { visibility: value }), (updated) => {
      // Repasser en « Privée » retire l'accès des amis (fait par le serveur).
      if (value === 'private') this.sharedWith.set([]);
      this.notice.set(value === 'private' ? 'La playlist est de nouveau privée.' : value === 'public' ? 'La playlist est publique.' : 'Seuls les amis choisis la voient.');
      this.changed.emit(updated);
    }, () => this.visibility.set(previous));
  }

  share(user: UserSummary): void {
    this.run(this.library.sharePlaylist(this.playlist().id, [user.id]), (updated) => {
      this.sharedWith.set(updated.sharedWith);
      this.visibility.set(updated.visibility);
      this.notice.set(`${user.name} peut maintenant voir la playlist (une notification lui a été envoyée).`);
      this.changed.emit(updated);
    });
  }

  unshare(user: UserSummary): void {
    this.run(this.library.unsharePlaylist(this.playlist().id, user.id), (updated) => {
      this.sharedWith.set(updated.sharedWith);
      this.notice.set(`${user.name} n’a plus accès à la playlist.`);
      this.changed.emit(updated);
    });
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link());
      this.notice.set('Lien copié.');
    } catch {
      this.notice.set('Copie impossible : sélectionnez le lien et copiez-le à la main.');
    }
  }

  private run<T>(request: Observable<T>, done: (value: T) => void, failed?: () => void): void {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        done(value);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        failed?.();
        this.error.set(httpMessage(error, 'La modification n’a pas pu être enregistrée.'));
      },
    });
  }
}
