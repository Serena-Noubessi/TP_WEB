import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { finalize, firstValueFrom, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { LibraryService, ReactionType } from './library.service';

/**
 * « J'aime » et favoris de l'utilisateur connecté, partagés par toute
 * l'application (cartes, lecteur, bibliothèque). Enregistrés en base.
 */
@Injectable({ providedIn: 'root' })
export class ReactionsService {
  private readonly auth = inject(AuthService);
  private readonly library = inject(LibraryService);

  readonly likes = signal<ReadonlySet<string>>(new Set());
  readonly favorites = signal<ReadonlySet<string>>(new Set());
  /** Nombre de « j'aime » connu après une action (prioritaire sur celui reçu avec la piste). */
  readonly likeCounts = signal<ReadonlyMap<string, number>>(new Map());
  /** Message court affiché après une action (toast). */
  readonly flash = signal('');
  /** Vrai une fois les réactions lues depuis le serveur (compteurs fiables). */
  readonly loaded = signal(false);
  /**
   * Une relecture ne doit jamais effacer une action plus récente : elle est ignorée
   * si une action était en route à son lancement ou à son retour (le serveur a pu
   * lire l'état avant d'enregistrer l'action), ou si une action a commencé entretemps.
   */
  private version = 0;
  private inFlight = 0;

  constructor() {
    effect(() => {
      const token = this.auth.token();
      untracked(() => (token ? void this.refresh() : this.reset()));
    });
  }

  has(trackId: string, type: ReactionType): boolean {
    return (type === 'like' ? this.likes() : this.favorites()).has(trackId);
  }

  async refresh(): Promise<void> {
    if (!this.auth.token()) return this.reset();
    const startedAt = this.version;
    const busyAtStart = this.inFlight > 0;
    try {
      const { likes, favorites } = await firstValueFrom(this.library.reactions());
      if (busyAtStart || startedAt !== this.version || this.inFlight > 0) return;
      this.likes.set(new Set(likes));
      this.favorites.set(new Set(favorites));
      this.loaded.set(true);
    } catch (error) {
      console.warn('[Reactions] Lecture impossible', error);
    }
  }

  /** Inverse la réaction ; la mise à jour de l'écran est immédiate puis confirmée par le serveur. */
  toggle$(trackId: string, type: ReactionType) {
    const target = type === 'like' ? this.likes : this.favorites;
    const active = !target().has(trackId);
    this.version++;
    this.inFlight++;
    this.apply(target, trackId, active);
    return this.library.react(trackId, type, active).pipe(
      finalize(() => this.inFlight--),
      tap({
        next: (result) => this.likeCounts.update((map) => new Map(map).set(trackId, result.likeCount)),
        error: () => this.apply(target, trackId, !active),
      }),
    );
  }

  private apply(target: typeof this.likes, trackId: string, active: boolean): void {
    target.update((set) => {
      const next = new Set(set);
      if (active) next.add(trackId);
      else next.delete(trackId);
      return next;
    });
  }

  private reset(): void {
    this.loaded.set(false);
    this.likes.set(new Set());
    this.favorites.set(new Set());
  }
}
