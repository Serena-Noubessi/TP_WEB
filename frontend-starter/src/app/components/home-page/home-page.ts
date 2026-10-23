import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { CATEGORIES } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { AuthService } from '../../shared/services/auth.service';
import { PublicHome, PublicService } from '../../shared/services/public.service';
import { IconComponent } from '../icon/icon';
import { TrackTileComponent } from '../track-tile/track-tile';

/** Accueil MOST VIBE, accessible sans compte : contenus publics uniquement. */
@Component({
  imports: [RouterLink, IconComponent, TrackTileComponent],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePageComponent {
  private readonly service = inject(PublicService);
  readonly player = inject(AudioPlayerService);
  readonly auth = inject(AuthService);
  readonly categories = CATEGORIES;

  readonly home = signal<PublicHome | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.home().subscribe({
      next: (home) => {
        this.home.set(home);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[HomePage] Accueil indisponible', error);
        this.error.set(
          error.status === 0 || error.status === 502
            ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré, puis réessayez.'
            : 'L’accueil n’a pas pu être chargé.',
        );
        this.loading.set(false);
      },
    });
  }

  /** Lit la piste choisie ; le reste de la section devient la file d'attente. */
  play(list: Track[], index: number): void {
    const track = list[index];
    if (this.player.current()?.id === track.id) this.player.togglePlay();
    else this.player.playList(list, index);
  }

  totalPublic(): number {
    return Object.values(this.home()?.styles ?? {}).reduce<number>((sum, count) => sum + (count ?? 0), 0);
  }
}
