import { Component, computed, ElementRef, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { displayTitle } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { AuthService } from '../../shared/services/auth.service';
import { httpMessage, LibraryService, Playlist, ReactionType } from '../../shared/services/library.service';
import { PendingActionService } from '../../shared/services/pending-action.service';
import { ReactionsService } from '../../shared/services/reactions.service';
import { IconComponent } from '../icon/icon';
import { RemixDialogComponent } from '../remix-dialog/remix-dialog';
import { ReportDialogComponent } from '../report-dialog/report-dialog';

/**
 * Boutons « J'aime », « Favori » et « Ajouter à une playlist » d'une piste.
 * Un visiteur est invité à se connecter ; son « j'aime » ou son favori est alors
 * exécuté automatiquement après la connexion (PendingActionService).
 */
@Component({
  selector: 'app-reaction-buttons',
  imports: [IconComponent, RemixDialogComponent, ReportDialogComponent],
  host: { '(document:click)': 'closeOnOutside($event)', '(document:keydown.escape)': 'menuOpen.set(false); moreOpen.set(false)' },
  template: `
    @let id = track().id;
    @let liked = reactions.likes().has(id);
    @let favorite = reactions.favorites().has(id);
    <div class="reactions" [class.compact]="compact()">
      <button type="button" class="react like" [class.on]="liked" (click)="react('like')" [attr.aria-pressed]="liked"
        [attr.aria-label]="(liked ? 'Ne plus aimer ' : 'J’aime ') + title()" [title]="liked ? 'Je n’aime plus' : 'J’aime'">
        <app-icon name="heart" [filled]="liked" />
        @if (!compact()) { <span class="count">{{ likeCount() }}</span> }
      </button>
      <button type="button" class="react favorite" [class.on]="favorite" (click)="react('favorite')" [attr.aria-pressed]="favorite"
        [attr.aria-label]="(favorite ? 'Retirer des favoris ' : 'Ajouter aux favoris ') + title()" [title]="favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'">
        <app-icon name="star" [filled]="favorite" />
      </button>
      @if (playlistButton()) {
        <span class="menu-anchor">
          <button type="button" class="react" (click)="togglePlaylists()" [attr.aria-expanded]="menuOpen()" aria-haspopup="true"
            [attr.aria-label]="'Ajouter ' + title() + ' à une playlist'" title="Ajouter à une playlist">
            <app-icon name="list-plus" />
          </button>
          @if (menuOpen()) {
            <div class="menu" role="dialog" aria-label="Ajouter à une playlist">
              <p class="menu-title">Ajouter à une playlist</p>
              @if (loadingPlaylists()) {
                <p class="menu-note">Chargement…</p>
              } @else {
                @for (playlist of playlists(); track playlist.id) {
                  <button type="button" class="menu-item" (click)="addTo(playlist)">
                    <app-icon name="list-music" /> <span>{{ playlist.name }}</span> <small>{{ playlist.trackCount }}</small>
                  </button>
                } @empty {
                  <p class="menu-note">Aucune playlist pour l’instant.</p>
                }
                <form class="menu-new" (submit)="$event.preventDefault(); createAndAdd(newName.value); newName.value = ''">
                  <input #newName type="text" maxlength="80" placeholder="Nouvelle playlist" aria-label="Nom de la nouvelle playlist" />
                  <button type="submit" aria-label="Créer la playlist et y ajouter la piste"><app-icon name="plus" /></button>
                </form>
              }
              @if (menuMessage()) { <p class="menu-note" role="status">{{ menuMessage() }}</p> }
            </div>
          }
        </span>
      }
      @if (othersTrack()) {
        <span class="menu-anchor">
          <button type="button" class="react" (click)="moreOpen.set(!moreOpen()); menuOpen.set(false)" [attr.aria-expanded]="moreOpen()" aria-haspopup="true"
            [attr.aria-label]="'Plus d’actions pour ' + title()" title="Plus d’actions">
            <app-icon name="more" />
          </button>
          @if (moreOpen()) {
            <div class="menu" role="menu" aria-label="Plus d’actions">
              <button type="button" role="menuitem" class="menu-item" (click)="moreOpen.set(false); remixing.set(true)"><app-icon name="shuffle" /> <span>Remixer</span></button>
              <button type="button" role="menuitem" class="menu-item" (click)="moreOpen.set(false); reporting.set(true)"><app-icon name="flag" /> <span>Signaler</span></button>
            </div>
          }
        </span>
      }
    </div>
    @if (remixing()) { <app-remix-dialog [track]="track()" (closed)="remixing.set(false)" /> }
    @if (reporting()) { <app-report-dialog targetType="track" [targetId]="track().id" [label]="title()" (closed)="reporting.set(false)" /> }
  `,
  styles: `
    :host { display: inline-block; }
    .reactions { display: inline-flex; align-items: center; gap: 0.3rem; }
    button.react {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      min-height: 2.1rem;
      padding: 0.3rem 0.55rem;
      border: 1px solid var(--mv-border);
      border-radius: 999px;
      color: var(--mv-muted);
      background: var(--mv-card);
      font-size: 0.8rem;
      font-weight: 700;
    }
    .compact button.react { min-height: 2rem; padding: 0.3rem 0.45rem; }
    button.react:hover { color: var(--mv-primary); border-color: var(--mv-border-strong); background: var(--mv-control-hover); }
    button.like.on { color: #e0245e; border-color: color-mix(in srgb, #e0245e 35%, var(--mv-border)); }
    button.favorite.on { color: var(--mv-warning); border-color: color-mix(in srgb, var(--mv-warning) 40%, var(--mv-border)); }
    .menu-anchor { position: relative; }
    .menu {
      position: absolute;
      z-index: 30;
      right: 0;
      bottom: calc(100% + 0.4rem);
      display: grid;
      gap: 0.25rem;
      width: min(16rem, 80vw);
      padding: 0.6rem;
      border: 1px solid var(--mv-border);
      border-radius: 12px;
      background: var(--mv-card);
      box-shadow: var(--mv-shadow);
    }
    .menu-title { margin: 0 0 0.2rem; font-size: 0.8rem; font-weight: 800; color: var(--mv-text); }
    .menu-note { margin: 0.2rem 0; color: var(--mv-muted); font-size: 0.8rem; }
    .menu-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.5rem;
      border-radius: 8px;
      color: var(--mv-text);
      background: transparent;
      font-size: 0.85rem;
      text-align: left;
    }
    .menu-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .menu-item small { color: var(--mv-muted); }
    .menu-item:hover { background: var(--mv-control-hover); }
    .menu-new { display: flex; gap: 0.3rem; margin-top: 0.2rem; }
    .menu-new input { flex: 1; min-width: 0; padding: 0.35rem 0.5rem; font-size: 0.85rem; }
    .menu-new button { display: grid; place-items: center; padding: 0.35rem 0.55rem; }
  `,
})
export class ReactionButtonsComponent {
  readonly reactions = inject(ReactionsService);
  private readonly auth = inject(AuthService);
  private readonly pending = inject(PendingActionService);
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly track = input.required<Track & { likeCount?: number }>();
  /** Version réduite (lecteur, listes) : sans le compteur. */
  readonly compact = input(false);
  readonly playlistButton = input(true);

  readonly title = computed(() => `« ${displayTitle(this.track())} »`);
  readonly likeCount = computed(() => this.reactions.likeCounts().get(this.track().id) ?? this.track().likeCount ?? 0);

  readonly menuOpen = signal(false);
  /** Menu « ⋯ » (Remixer, Signaler) : seulement pour la piste d'un autre membre, une fois connecté. */
  readonly moreOpen = signal(false);
  readonly remixing = signal(false);
  readonly reporting = signal(false);
  readonly othersTrack = computed(() => {
    const me = this.auth.userId();
    const owner = this.track().author?.id ?? this.track().ownerId;
    return !!me && !!owner && owner !== me && !this.track().online;
  });
  readonly playlists = signal<Playlist[]>([]);
  readonly loadingPlaylists = signal(false);
  readonly menuMessage = signal('');

  react(type: ReactionType): void {
    const track = this.track();
    if (!this.auth.token()) {
      const verb = type === 'like' ? 'aimer' : 'ajouter à vos favoris';
      this.pending.requireLogin({ type, trackId: track.id, label: `${verb} ${this.title()}` });
      return;
    }
    this.reactions.toggle$(track.id, type).subscribe({
      next: (result) =>
        this.reactions.flash.set(
          type === 'favorite' ? (result.active ? `${this.title()} ajouté à vos favoris` : `${this.title()} retiré de vos favoris`) : '',
        ),
      error: (error: unknown) => this.reactions.flash.set(httpMessage(error, 'L’action n’a pas pu être enregistrée. Réessayez.')),
    });
  }

  togglePlaylists(): void {
    if (!this.auth.token()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url, reason: 'action' } });
      return;
    }
    const open = !this.menuOpen();
    this.menuOpen.set(open);
    this.menuMessage.set('');
    if (!open) return;
    this.loadingPlaylists.set(true);
    this.library.playlists().subscribe({
      next: ({ playlists }) => {
        this.playlists.set(playlists);
        this.loadingPlaylists.set(false);
      },
      error: (error: unknown) => {
        this.loadingPlaylists.set(false);
        this.menuMessage.set(httpMessage(error, 'Impossible de charger vos playlists.'));
      },
    });
  }

  addTo(playlist: Playlist): void {
    this.library.addToPlaylist(playlist.id, this.track().id).subscribe({
      next: (updated) => {
        this.playlists.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        this.menuMessage.set(`Ajouté à « ${updated.name} ».`);
      },
      error: (error: unknown) => this.menuMessage.set(httpMessage(error, 'Ajout impossible.')),
    });
  }

  createAndAdd(name: string): void {
    if (!name.trim()) {
      this.menuMessage.set('Donnez un nom à la playlist.');
      return;
    }
    this.library.createPlaylist({ name: name.trim() }).subscribe({
      next: (playlist) => {
        this.playlists.update((list) => [playlist, ...list]);
        this.addTo(playlist);
      },
      error: (error: unknown) => this.menuMessage.set(httpMessage(error, 'Création impossible.')),
    });
  }

  closeOnOutside(event: MouseEvent): void {
    if (this.host.nativeElement.contains(event.target as Node)) return;
    this.menuOpen.set(false);
    this.moreOpen.set(false);
  }
}
