import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AuthService } from './auth.service';
import { Counters, SocialService } from './social.service';

/** Intervalle de mise à jour des pastilles (messages, notifications, invitations). */
const POLL_MS = 20_000;

/**
 * Compteurs affichés dans le menu (pastilles). Ils sont relus toutes les 20 s
 * tant que l'onglet est visible, dès que l'utilisateur revient sur l'onglet, et
 * à la demande (après avoir lu une conversation, par exemple).
 */
@Injectable({ providedIn: 'root' })
export class CountersService {
  private readonly auth = inject(AuthService);
  private readonly social = inject(SocialService);
  private readonly document = inject(DOCUMENT);

  readonly counters = signal<Counters>({ messages: 0, notifications: 0, invitations: 0 });
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    const onVisible = () => {
      if (this.document.visibilityState === 'visible') this.refresh();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    effect(() => {
      const token = this.auth.token();
      untracked(() => {
        clearInterval(this.timer);
        if (!token) {
          this.counters.set({ messages: 0, notifications: 0, invitations: 0 });
          return;
        }
        this.refresh();
        this.timer = setInterval(() => {
          if (this.document.visibilityState === 'visible') this.refresh();
        }, POLL_MS);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.timer);
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }

  refresh(): void {
    if (!this.auth.token()) return;
    this.social.counters().subscribe({
      next: (counters) => this.counters.set(counters),
      // Un échec ponctuel (réseau) garde les anciens compteurs ; il est seulement journalisé.
      error: (error: unknown) => console.warn('[Counters] Lecture impossible', error),
    });
  }
}
