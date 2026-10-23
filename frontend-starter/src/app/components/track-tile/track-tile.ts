import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { CoverImageComponent } from '../cover-image/cover-image';
import { IconComponent } from '../icon/icon';
import { ReactionButtonsComponent } from '../reaction-buttons/reaction-buttons';

/** Carte d'une piste : pochette, titre, style et auteur, bouton de lecture, j'aime, favori et playlist. */
@Component({
  selector: 'app-track-tile',
  imports: [IconComponent, ReactionButtonsComponent, CoverImageComponent, RouterLink],
  template: `
    @let item = track();
    @let category = categoryOf(item);
    <article class="tile" [class.is-current]="isCurrent()" [style.--cat]="category.color">
      <div class="art">
        <app-cover-image [url]="item.coverUrl ?? item.online?.imageUrl" [direct]="item.visibility === 'public' || !item.coverUrl" [alt]="'Pochette de ' + displayTitle(item)">
          <span class="art-icon" aria-hidden="true"><app-icon [name]="category.icon" size="2.4rem" [strokeWidth]="1.5" /></span>
        </app-cover-image>
        <button type="button" class="play" (click)="play.emit()" [attr.aria-label]="(isCurrent() && player.playing() ? 'Pause : ' : 'Écouter : ') + displayTitle(item)">
          <app-icon [name]="isCurrent() && player.playing() ? 'pause' : 'play'" size="1.2rem" />
        </button>
        @if (item.kind === 'mix') {
          <span class="kind">Mixage</span>
        }
      </div>
      <h3 [title]="displayTitle(item)">{{ displayTitle(item) }}</h3>
      <p class="meta">
        <span class="style"><app-icon [name]="category.icon" /> {{ category.label }}</span>
        @if (item.author?.id) {
          <a class="author" [routerLink]="['/u', item.author!.id]" [title]="'Profil de ' + item.author!.name">{{ item.author!.name }}</a>
        } @else {
          <span class="author">{{ item.author?.name ?? 'Auteur inconnu' }}</span>
        }
      </p>
      @if (item.credits; as credits) {
        <p class="credits" [title]="creditsText(item)">
          <app-icon name="shuffle" /> Remix par {{ credits.remixBy.name }}
          @if (sourceAuthors(item); as authors) { · À partir de la création de {{ authors }} }
        </p>
      }
      @if (reactions()) {
        <app-reaction-buttons [track]="item" />
      }
    </article>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .tile { display: grid; gap: 0.45rem; }
    .art {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 14px;
      background: linear-gradient(140deg, color-mix(in srgb, var(--cat) 30%, var(--mv-card)), color-mix(in srgb, var(--mv-secondary) 25%, var(--mv-card)));
    }
        .art-icon { position: absolute; inset: 0; display: grid; place-items: center; color: var(--cat); }
    .tile button.play {
      position: absolute;
      right: 0.6rem;
      bottom: 0.6rem;
      display: grid;
      width: 2.8rem;
      height: 2.8rem;
      padding: 0;
      place-items: center;
      border-radius: 50%;
      color: var(--mv-on-accent);
      background: var(--mv-primary);
      box-shadow: 0 6px 16px rgb(0 127 255 / 35%);
      opacity: 0.92;
      transition: transform 140ms ease, opacity 140ms ease;
    }
    .tile:hover button.play, .tile.is-current button.play, .tile button.play:focus-visible { opacity: 1; transform: scale(1.06); }
    .kind {
      position: absolute;
      top: 0.55rem;
      left: 0.55rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      color: var(--mv-text);
      background: var(--mv-secondary-soft);
      font-size: 0.7rem;
      font-weight: 700;
    }
    h3 { overflow: hidden; margin: 0; font-size: 0.95rem; text-overflow: ellipsis; white-space: nowrap; }
    .meta { display: flex; flex-wrap: wrap; gap: 0.2rem 0.6rem; margin: 0; color: var(--mv-muted); font-size: 0.8rem; }
    .style { display: inline-flex; align-items: center; gap: 0.25rem; color: color-mix(in srgb, var(--cat) 70%, var(--mv-text)); font-weight: 600; }
    .author { overflow: hidden; color: inherit; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
    a.author:hover { color: var(--mv-primary); text-decoration: underline; }
    .credits { display: -webkit-box; overflow: hidden; margin: 0; color: var(--mv-secondary-strong); font-size: 0.75rem; font-weight: 600; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  `,
})
export class TrackTileComponent {
  readonly player = inject(AudioPlayerService);
  readonly track = input.required<Track>();
  readonly play = output<void>();
  /** Affiche les boutons j'aime / favori / playlist (vrai par défaut). */
  readonly reactions = input(true);
  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  readonly isCurrent = computed(() => this.player.current()?.id === this.track().id);

  /** Auteurs des pistes d'origine (hors le remixeur lui-même), sans doublon. */
  sourceAuthors(track: Track): string {
    const credits = track.credits;
    if (!credits) return '';
    const names = [...new Set(credits.sources.filter((source) => source.ownerId !== credits.remixBy.id).map((source) => source.ownerName))];
    names.push(...credits.external.map((item) => item.artist));
    return names.join(', ');
  }

  creditsText(track: Track): string {
    const credits = track.credits;
    if (!credits) return '';
    const sources = [...credits.sources.map((source) => `« ${source.title} » de ${source.ownerName}`), ...credits.external.map((item) => `« ${item.title} » de ${item.artist} (${item.license})`)];
    return `Remix par ${credits.remixBy.name}. Sources : ${sources.join(', ')}.`;
  }
}
