import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formatDuration } from '../../shared/audio/duration';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { AuthService } from '../../shared/services/auth.service';
import { COMMENT_MAX_LENGTH, CommentsService, TrackComment } from '../../shared/services/comments.service';
import { DownloadService, downloadErrorMessage } from '../../shared/services/download.service';
import { httpMessage } from '../../shared/services/library.service';
import { PublicService } from '../../shared/services/public.service';
import { ReactionsService } from '../../shared/services/reactions.service';
import { WaveformService } from '../../shared/services/waveform.service';
import { CoverImageComponent } from '../cover-image/cover-image';
import { IconComponent } from '../icon/icon';
import { ReactionButtonsComponent } from '../reaction-buttons/reaction-buttons';
import { WaveformComponent } from '../waveform/waveform';

/**
 * Page d'une piste (/t/:id) : grande forme d'onde, écoute, téléchargement et
 * commentaires. Le serveur applique la règle d'écoute : une piste publique est
 * visible par tous (les visiteurs lisent les avis mais doivent se connecter pour
 * en écrire) ; une piste « Amis choisis » seulement par les personnes autorisées.
 */
@Component({
  imports: [RouterLink, ReactiveFormsModule, IconComponent, CoverImageComponent, ReactionButtonsComponent, WaveformComponent],
  template: `
    <section class="track-page">
      @if (error(); as message) {
        <div class="state error" role="alert">
          <app-icon name="lock" size="1.6rem" />
          <p>{{ message }}</p>
          @if (status() === 401) {
            <a class="btn primary" routerLink="/login" [queryParams]="{ returnUrl: currentUrl(), reason: 'action' }">Se connecter</a>
          } @else {
            <a class="btn ghost" routerLink="/explore">Explorer les pistes publiques</a>
          }
        </div>
      } @else if (!track()) {
        <p class="state" role="status">Chargement de la piste…</p>
      } @else {
        @let item = track()!;
        @let category = categoryOf(item);
        <header class="hero" [style.--cat]="category.color">
          <div class="art">
            <app-cover-image [url]="item.coverUrl" [direct]="item.visibility === 'public' || !item.coverUrl" [alt]="'Pochette de ' + displayTitle(item)">
              <span class="art-icon" aria-hidden="true"><app-icon [name]="category.icon" size="3rem" [strokeWidth]="1.5" /></span>
            </app-cover-image>
          </div>
          <div class="info">
            <p class="kicker"><app-icon [name]="category.icon" /> {{ category.label }}@if (item.kind === 'mix') { · Mixage }@if (item.durationSeconds) { · {{ formatDuration(item.durationSeconds) }} }</p>
            <h1>{{ displayTitle(item) }}</h1>
            <p class="by">
              par
              @if (item.author?.id) {
                <a [routerLink]="['/u', item.author!.id]">{{ item.author!.name }}</a>
              } @else {
                {{ item.author?.name ?? 'Auteur inconnu' }}
              }
              @if (item.album) { · album « {{ item.album }} » }
            </p>
            @if (item.credits; as credits) {
              <p class="credits"><app-icon name="shuffle" /> Remix par {{ credits.remixBy.name }} · sources : {{ sourcesText(item) }}</p>
            }
            <div class="buttons">
              <button type="button" class="btn primary play" (click)="play()">
                <app-icon [name]="isCurrent() && player.playing() ? 'pause' : 'play'" />
                {{ isCurrent() && player.playing() ? 'Pause' : 'Écouter' }}
              </button>
              <button type="button" class="btn ghost" (click)="download()" [disabled]="downloading()">
                <app-icon name="download" /> {{ downloading() ? 'Téléchargement…' : 'Télécharger' }}
              </button>
              <app-reaction-buttons [track]="item" />
            </div>
          </div>
        </header>

        <div class="wave-box">
          <app-waveform
            class="big-wave"
            [peaks]="waveforms.of(item)"
            [progress]="isCurrent() && player.duration() ? player.time() / player.duration() : null"
            [seekable]="isCurrent()"
            (seek)="player.seek($event * player.duration())"
          />
          @if (!waveforms.of(item)) {
            <p class="hint">La forme d’onde apparaîtra quand l’auteur aura rouvert sa bibliothèque.</p>
          } @else if (!isCurrent()) {
            <p class="hint">Lancez l’écoute puis cliquez sur la forme d’onde pour aller à un passage.</p>
          }
        </div>

        <section id="comments" class="comments" aria-labelledby="comments-title">
          <h2 id="comments-title">Commentaires <span class="count">{{ total() }}</span></h2>

          @if (canComment()) {
            <form class="new-comment" (submit)="$event.preventDefault(); send()">
              <label for="comment-text" class="sr-only">Votre commentaire</label>
              <textarea id="comment-text" rows="3" [formControl]="text" [attr.maxlength]="maxLength" placeholder="Donnez votre avis sur ce morceau…"></textarea>
              <div class="form-foot">
                <small>{{ text.value.length }} / {{ maxLength }}</small>
                <button type="submit" class="btn primary small" [disabled]="sending() || !text.value.trim()">
                  <app-icon name="message" /> {{ sending() ? 'Envoi…' : 'Publier' }}
                </button>
              </div>
            </form>
          } @else if (!auth.token()) {
            <p class="invite">
              <a routerLink="/login" [queryParams]="{ returnUrl: currentUrl(), reason: 'action' }">Connectez-vous</a> pour laisser un commentaire.
            </p>
          } @else if (loaded()) {
            <p class="invite">Vous ne pouvez pas commenter cette piste.</p>
          }
          @if (commentError()) { <p class="state error" role="alert">{{ commentError() }}</p> }

          @if (!loaded()) {
            <p class="state" role="status">Chargement des commentaires…</p>
          } @else {
            <ul class="list">
              @for (comment of comments(); track comment.id) {
                <li class="comment" [class.mine]="comment.mine">
                  <span class="avatar" aria-hidden="true">{{ comment.author.name.charAt(0).toUpperCase() }}</span>
                  <div class="body">
                    <p class="head">
                      <a [routerLink]="['/u', comment.author.id]">{{ comment.author.name }}</a>
                      <time [attr.datetime]="comment.createdAt">{{ when(comment.createdAt) }}</time>
                    </p>
                    <p class="text">{{ comment.text }}</p>
                  </div>
                  @if (comment.canDelete) {
                    <button type="button" class="icon-btn" (click)="remove(comment)" [attr.aria-label]="'Supprimer le commentaire de ' + comment.author.name" title="Supprimer">
                      <app-icon name="trash" />
                    </button>
                  }
                </li>
              } @empty {
                <li class="state">Aucun commentaire pour l’instant.@if (canComment()) { Soyez le premier à donner votre avis ! }</li>
              }
            </ul>
            @if (hasMore()) {
              <button type="button" class="btn ghost small more" (click)="loadMore()" [disabled]="loadingMore()">
                {{ loadingMore() ? 'Chargement…' : 'Voir les commentaires plus anciens' }}
              </button>
            }
          }
        </section>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .track-page { display: grid; gap: 1.3rem; max-width: 960px; margin: 0 auto; }
    .hero { display: grid; grid-template-columns: minmax(9rem, 13rem) minmax(0, 1fr); gap: 1.4rem; align-items: center; }
    .art { position: relative; overflow: hidden; aspect-ratio: 1; border-radius: 18px; background: linear-gradient(140deg, color-mix(in srgb, var(--cat) 30%, var(--mv-card)), color-mix(in srgb, var(--mv-secondary) 25%, var(--mv-card))); }
    .art-icon { position: absolute; inset: 0; display: grid; place-items: center; color: var(--cat); }
    .info { display: grid; gap: 0.45rem; min-width: 0; }
    .kicker { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0; color: color-mix(in srgb, var(--cat) 70%, var(--mv-text)); font-weight: 700; }
    h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(1.4rem, 3vw, 2.1rem); }
    .by, .credits { margin: 0; color: var(--mv-muted); }
    .by a { color: var(--mv-primary); font-weight: 700; }
    .credits { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--mv-secondary-strong); font-size: 0.85rem; font-weight: 600; }
    .buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.3rem; }
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1rem; border: 1px solid var(--mv-border); border-radius: 999px; font-weight: 700; text-decoration: none; }
    .btn.primary { color: var(--mv-on-accent); border-color: transparent; background: var(--mv-primary); }
    .btn.ghost { color: var(--mv-text); background: var(--mv-card); }
    .btn.small { padding: 0.35rem 0.8rem; font-size: 0.85rem; }
    .wave-box { display: grid; gap: 0.4rem; padding: 1rem 1.1rem; border: 1px solid var(--mv-border); border-radius: 16px; background: var(--mv-card); }
    .big-wave { --wave-height: 4.5rem; }
    .hint { margin: 0; color: var(--mv-muted); font-size: 0.8rem; }
    .comments { display: grid; gap: 0.8rem; scroll-margin-top: 5rem; }
    h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.25rem; }
    .count { padding: 0.05rem 0.55rem; border-radius: 999px; color: var(--mv-primary-strong); background: var(--mv-primary-soft); font-size: 0.85rem; }
    .new-comment { display: grid; gap: 0.4rem; }
    .new-comment textarea { width: 100%; resize: vertical; }
    .form-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; color: var(--mv-muted); }
    .invite { margin: 0; padding: 0.7rem 0.9rem; border-radius: 12px; background: var(--mv-primary-soft); }
    .invite a { font-weight: 700; }
    .list { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
    .comment { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.7rem; align-items: start; padding: 0.75rem 0.9rem; border: 1px solid var(--mv-border); border-radius: 14px; background: var(--mv-card); }
    .comment.mine { border-color: color-mix(in srgb, var(--mv-primary) 35%, var(--mv-border)); }
    .avatar { display: grid; width: 2.2rem; height: 2.2rem; place-items: center; border-radius: 50%; color: var(--mv-on-accent); background: var(--mv-gradient); font-weight: 800; }
    .body { display: grid; gap: 0.2rem; min-width: 0; }
    .head { display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; margin: 0; font-size: 0.85rem; }
    .head a { color: var(--mv-text); font-weight: 700; text-decoration: none; }
    .head a:hover { color: var(--mv-primary); text-decoration: underline; }
    time { color: var(--mv-muted); }
    .text { margin: 0; overflow-wrap: anywhere; white-space: pre-line; }
    .icon-btn { display: grid; place-items: center; padding: 0.35rem; border-radius: 8px; color: var(--mv-muted); background: transparent; }
    .icon-btn:hover { color: var(--mv-danger-strong); background: var(--mv-control-hover); }
    .more { justify-self: center; }
    .state { margin: 0; padding: 0.8rem; color: var(--mv-muted); }
    .state.error { display: grid; gap: 0.6rem; justify-items: start; color: var(--mv-danger-strong); font-weight: 600; }
    .state.error p { margin: 0; }
    @media (max-width: 640px) {
      .hero { grid-template-columns: 1fr; }
      .art { width: min(14rem, 70vw); justify-self: center; }
    }
  `,
})
export class TrackPageComponent implements OnInit {
  readonly player = inject(AudioPlayerService);
  readonly auth = inject(AuthService);
  readonly waveforms = inject(WaveformService);
  private readonly publicService = inject(PublicService);
  private readonly commentsService = inject(CommentsService);
  private readonly downloads = inject(DownloadService);
  private readonly reactions = inject(ReactionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  readonly formatDuration = formatDuration;
  readonly maxLength = COMMENT_MAX_LENGTH;

  readonly track = signal<Track | null>(null);
  readonly error = signal('');
  readonly status = signal(0);
  readonly downloading = signal(false);

  readonly comments = signal<TrackComment[]>([]);
  readonly total = signal(0);
  readonly hasMore = signal(false);
  readonly canComment = signal(false);
  readonly loaded = signal(false);
  readonly loadingMore = signal(false);
  readonly sending = signal(false);
  readonly commentError = signal('');
  readonly text = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(COMMENT_MAX_LENGTH)] });

  readonly isCurrent = computed(() => !!this.track() && this.player.current()?.id === this.track()!.id);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.load(params.get('id') ?? ''));
  }

  currentUrl(): string {
    return this.router.url;
  }

  private load(id: string): void {
    this.track.set(null);
    this.error.set('');
    this.loaded.set(false);
    this.comments.set([]);
    this.publicService.track(id).subscribe({
      next: (track) => {
        this.track.set(track);
        this.loadComments(id);
      },
      error: (error: unknown) => {
        const status = (error as { status?: number }).status ?? 0;
        this.status.set(status);
        this.error.set(
          status === 401 ? 'Cette piste n’est pas publique : connectez-vous pour l’écouter si elle a été partagée avec vous.'
          : status === 403 ? 'Cette piste n’a pas été partagée avec vous.'
          : httpMessage(error, 'Cette piste n’existe pas ou a été supprimée.'),
        );
      },
    });
  }

  private loadComments(trackId: string): void {
    this.commentsService.list(trackId).subscribe({
      next: (page) => {
        this.comments.set(page.comments);
        this.total.set(page.total);
        this.hasMore.set(page.hasMore);
        this.canComment.set(page.canComment);
        this.loaded.set(true);
        // Arrivée depuis une notification ou le menu « Commentaires » : on descend jusqu'aux avis.
        if (this.route.snapshot.fragment === 'comments') setTimeout(() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' }));
      },
      error: (error: unknown) => {
        this.loaded.set(true);
        this.commentError.set(httpMessage(error, 'Impossible de charger les commentaires.'));
      },
    });
  }

  loadMore(): void {
    const last = this.comments().at(-1);
    if (!last) return;
    this.loadingMore.set(true);
    this.commentsService.list(this.track()!.id, last.createdAt).subscribe({
      next: (page) => {
        this.comments.update((list) => [...list, ...page.comments]);
        this.hasMore.set(page.hasMore);
        this.loadingMore.set(false);
      },
      error: (error: unknown) => {
        this.loadingMore.set(false);
        this.commentError.set(httpMessage(error, 'Impossible de charger la suite.'));
      },
    });
  }

  send(): void {
    const text = this.text.value.trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.commentError.set('');
    this.commentsService.add(this.track()!.id, text).subscribe({
      next: (comment) => {
        this.sending.set(false);
        this.text.reset();
        this.comments.update((list) => [comment, ...list]);
        this.total.update((count) => count + 1);
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.commentError.set(httpMessage(error, 'Le commentaire n’a pas pu être publié.'));
      },
    });
  }

  remove(comment: TrackComment): void {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    this.commentsService.remove(comment.id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((item) => item.id !== comment.id));
        this.total.update((count) => Math.max(0, count - 1));
      },
      error: (error: unknown) => this.commentError.set(httpMessage(error, 'Le commentaire n’a pas pu être supprimé.')),
    });
  }

  play(): void {
    if (this.isCurrent()) this.player.togglePlay();
    else this.player.playList([this.track()!], 0);
  }

  async download(): Promise<void> {
    this.downloading.set(true);
    try {
      await this.downloads.download(this.track()!);
    } catch (error) {
      this.reactions.flash.set(downloadErrorMessage(error));
    } finally {
      this.downloading.set(false);
    }
  }

  sourcesText(track: Track): string {
    const credits = track.credits!;
    return [...credits.sources.map((source) => `« ${source.title} » de ${source.ownerName}`), ...credits.external.map((item) => `« ${item.title} » de ${item.artist}`)].join(', ');
  }

  when(value: string): string {
    return new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
