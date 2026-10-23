import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { IconComponent } from '../icon/icon';
import { ReactionButtonsComponent } from '../reaction-buttons/reaction-buttons';

/**
 * Lecteur audio persistant de MOST VIBE, en bas de l'écran sur toutes les pages.
 * Il pilote le service de lecture partagé : la musique continue quand on change de page.
 * Masqué sur l'onglet Audio, qui affiche déjà le lecteur complet.
 */
@Component({
  selector: 'app-player-bar',
  imports: [RouterLink, IconComponent, ReactionButtonsComponent],
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.css',
})
export class PlayerBarComponent {
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

  readonly track = computed(() => (this.url().startsWith('/audio') ? null : this.player.current()));
  readonly progress = computed(() => (this.player.duration() ? (this.player.time() / this.player.duration()) * 100 : 0));

  seek(event: Event): void {
    this.player.seek((Number((event.target as HTMLInputElement).value) / 100) * this.player.duration());
  }

  changeVolume(event: Event): void {
    this.player.setVolume(Number((event.target as HTMLInputElement).value));
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
}
