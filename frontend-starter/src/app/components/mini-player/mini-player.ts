import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { IconComponent } from '../icon/icon';

/**
 * Mini-lecteur affiché dans la barre du haut quand de la musique est chargée
 * dans l'onglet Audio et qu'on se trouve sur un autre onglet (lecture en arrière-plan).
 */
@Component({
  selector: 'app-mini-player',
  imports: [RouterLink, IconComponent],
  template: `
    @if (visible(); as track) {
      <div class="mini" role="region" aria-label="Lecture en cours">
        <a routerLink="/audio" class="mini-title" [title]="'Ouvrir l’onglet Audio : ' + displayTitle(track)" [attr.aria-label]="'Lecture en cours : ' + displayTitle(track) + '. Ouvrir l’onglet Audio'">
          <app-icon [name]="player.playing() ? 'audio-lines' : categoryOf(track).icon" />
          <span>{{ displayTitle(track) }}</span>
        </a>
        <button type="button" (click)="player.togglePlay()" [attr.aria-label]="player.playing() ? 'Pause' : 'Lecture'">
          <app-icon [name]="player.playing() ? 'pause' : 'play'" />
        </button>
        <button type="button" (click)="player.next()" aria-label="Morceau suivant">
          <app-icon name="skip-forward" />
        </button>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }

    .mini {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex: 0 1 auto;
      min-width: 0;
      max-width: 13rem;
      padding: 0.25rem 0.35rem 0.25rem 0.7rem;
      border: 1px solid #376c5d;
      border-radius: 999px;
      background: #174b3e;
    }

    .mini-title {
      display: inline-flex;
      min-width: 0;
      align-items: center;
      gap: 0.45rem;
      color: #d9eee7;
      font-size: 0.85rem;
      text-decoration: none;
    }

    .mini-title span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mini button {
      display: inline-grid;
      width: 1.9rem;
      height: 1.9rem;
      flex: 0 0 auto;
      padding: 0;
      place-items: center;
      border: 0;
      border-radius: 50%;
      color: #123d32;
      background: #bde4d5;
      cursor: pointer;
    }

    .mini button:focus-visible,
    .mini-title:focus-visible {
      outline: 2px solid #bde4d5;
      outline-offset: 2px;
    }

    /* Fenêtre moyenne : seul l'icône et les boutons restent, pour ne pas tasser la navigation. */
    @media (max-width: 1400px) {
      .mini-title span { display: none; }
    }

    @media (max-width: 720px) {
      .mini { max-width: 100%; }
      .mini-title span { display: inline; }
    }
  `,
})
export class MiniPlayerComponent {
  readonly player = inject(AudioPlayerService);
  readonly displayTitle = displayTitle;
  readonly categoryOf = categoryOf;
  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: '' },
  );

  /** Visible sur les autres onglets uniquement : l'onglet Audio a déjà son lecteur complet. */
  readonly visible = computed(() => (this.url().startsWith('/audio') ? null : this.player.current()));
}
