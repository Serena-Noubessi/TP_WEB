import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { httpMessage, LibraryService, Playlist, PlaylistDetail } from '../../shared/services/library.service';
import { IconComponent } from '../icon/icon';
import { PlaylistShareDialogComponent } from '../playlist-share-dialog/playlist-share-dialog';
import { TrackTileComponent } from '../track-tile/track-tile';

/**
 * Page d'une playlist (/p/:id), ouverte depuis un lien partagé, un profil ou
 * une notification. Le serveur ne la montre qu'à son propriétaire, à tout le
 * monde si elle est publique, ou aux amis avec qui elle a été partagée. Chacun
 * n'y voit que les pistes qu'il a le droit d'écouter.
 */
@Component({
  imports: [RouterLink, IconComponent, TrackTileComponent, PlaylistShareDialogComponent],
  template: `
    <section class="playlist-page">
      @if (error()) {
        <div class="state error" role="alert">
          <app-icon name="lock" size="1.6rem" />
          <p>{{ error() }}</p>
          <a class="btn ghost" routerLink="/explore">Explorer les pistes publiques</a>
        </div>
      } @else if (!playlist()) {
        <p class="state" role="status">Chargement de la playlist…</p>
      } @else {
        @let p = playlist()!;
        <header class="head">
          <span class="cover" aria-hidden="true"><app-icon name="list-music" size="2.6rem" /></span>
          <div class="who">
            <p class="kicker">Playlist {{ visibilityLabel(p) }}</p>
            <h1>{{ p.name }}</h1>
            <p>
              @if (p.owner) { de <a [routerLink]="['/u', p.owner.id]">{{ p.owner.name }}</a> · }
              {{ p.tracks.length }} piste(s)
            </p>
            @if (p.description) { <p class="description">{{ p.description }}</p> }
          </div>
          <div class="actions">
            <button type="button" class="btn primary" (click)="playAll()" [disabled]="!p.tracks.length"><app-icon name="play" /> Tout écouter</button>
            @if (p.mine) {
              <button type="button" class="btn ghost" (click)="sharing.set(true)"><app-icon name="share" /> Partager</button>
            }
          </div>
        </header>

        @if (p.hiddenCount) {
          <p class="help"><app-icon name="lock" /> {{ p.hiddenCount }} piste(s) de cette playlist ne vous sont pas accessibles et sont masquées.</p>
        }
        @if (!p.tracks.length) {
          <p class="state">Cette playlist ne contient aucune piste que vous puissiez écouter.</p>
        } @else {
          <div class="tiles">
            @for (track of p.tracks; track track.id; let i = $index) {
              <app-track-tile [track]="track" (play)="play(i)" />
            }
          </div>
        }
        @if (sharing()) {
          <app-playlist-share-dialog [playlist]="p" (changed)="changed($event)" (closed)="sharing.set(false)" />
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .playlist-page { display: grid; gap: 1.2rem; }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 1.1rem; padding: 1.4rem; border-radius: 20px; color: white; background: var(--mv-gradient); }
    .cover { display: grid; width: 5.5rem; height: 5.5rem; place-items: center; border-radius: 16px; background: rgb(255 255 255 / 18%); }
    .who { flex: 1 1 14rem; min-width: 0; }
    .who h1 { margin: 0; overflow-wrap: anywhere; color: white; }
    .who p { margin: 0.2rem 0 0; color: rgb(255 255 255 / 90%); }
    .who a { color: white; font-weight: 700; }
    .kicker { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .description { white-space: pre-line; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.95rem; border: 1px solid transparent; border-radius: 999px; font-weight: 700; text-decoration: none; }
    .btn.primary { color: var(--mv-primary-strong); background: white; }
    .btn.ghost { color: white; border-color: rgb(255 255 255 / 60%); background: transparent; }
    .state .btn.ghost { color: var(--mv-text); border-color: var(--mv-border); }
    .help { display: flex; gap: 0.4rem; margin: 0; color: var(--mv-muted); }
    .tiles { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); }
    .state { margin: 0; padding: 0.8rem; color: var(--mv-muted); }
    .state.error { display: grid; gap: 0.6rem; justify-items: start; color: var(--mv-danger-strong); font-weight: 600; }
    .state.error p { margin: 0; }
    @media (max-width: 600px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class PlaylistPageComponent implements OnInit {
  private readonly library = inject(LibraryService);
  private readonly player = inject(AudioPlayerService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly playlist = signal<PlaylistDetail | null>(null);
  readonly error = signal('');
  readonly sharing = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.load(params.get('id') ?? ''));
  }

  private load(id: string): void {
    this.playlist.set(null);
    this.error.set('');
    this.library.playlist(id).subscribe({
      next: (playlist) => this.playlist.set(playlist),
      // 404 aussi pour une playlist privée : le serveur ne révèle pas qu'elle existe.
      error: (error: unknown) => {
        const message = 'Cette playlist n’existe pas, a été supprimée ou n’est pas partagée avec vous.';
        this.error.set((error as { status?: number }).status === 404 ? message : httpMessage(error, message));
      },
    });
  }

  visibilityLabel(playlist: PlaylistDetail): string {
    if (playlist.visibility === 'public') return 'publique';
    if (playlist.visibility === 'friends') return playlist.mine ? 'partagée avec des amis' : 'partagée avec vous';
    return 'privée';
  }

  changed(updated: Playlist): void {
    this.playlist.update((current) => (current ? { ...current, ...updated, tracks: current.tracks } : current));
  }

  playAll(): void {
    this.player.playList(this.playlist()!.tracks, 0);
  }

  play(index: number): void {
    const list = this.playlist()!.tracks;
    if (this.player.current()?.id === list[index].id) this.player.togglePlay();
    else this.player.playList(list, index);
  }
}
