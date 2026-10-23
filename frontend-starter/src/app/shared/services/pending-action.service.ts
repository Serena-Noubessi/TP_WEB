import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ReactionsService } from './reactions.service';

const STORAGE_KEY = 'mv_pending_action';

/** N'accepte qu'une adresse interne (« /explore?q=… »), jamais un autre site. */
export function safeReturnUrl(url: string | null | undefined): string | null {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') && !url.startsWith('/register') ? url : null;
}

/** Action sociale demandée par un visiteur, à exécuter dès qu'il est connecté. */
export interface PendingAction {
  type: 'like' | 'favorite';
  trackId: string;
  /** Texte affiché sur la page de connexion (« aimer “Soleil de Douala” »). */
  label: string;
  /** Page où revenir après la connexion. */
  returnUrl: string;
}

/**
 * Section 4 : un visiteur qui aime ou met en favori est invité à se connecter ;
 * l'action est mémorisée (sessionStorage : elle ne survit pas à la fermeture de
 * l'onglet) puis exécutée automatiquement après la connexion ou l'inscription.
 */
@Injectable({ providedIn: 'root' })
export class PendingActionService {
  private readonly router = inject(Router);
  private readonly reactions = inject(ReactionsService);

  /** Action en attente, ou null. */
  current(): PendingAction | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PendingAction) : null;
    } catch {
      return null;
    }
  }

  /** Mémorise l'action et envoie le visiteur vers la connexion. */
  requireLogin(action: Omit<PendingAction, 'returnUrl'>): void {
    const pending: PendingAction = { ...action, returnUrl: this.router.url };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } catch {
      // Stockage indisponible (navigation privée stricte) : la connexion reste possible, l'action sera à refaire.
    }
    void this.router.navigate(['/login'], { queryParams: { returnUrl: pending.returnUrl, reason: 'action' } });
  }

  /**
   * Texte du bandeau de la page de connexion. Une action n'est gardée que si l'on
   * arrive juste après l'avoir demandée (reason=action) ; sinon elle est oubliée.
   */
  labelFor(reason: string | null): string {
    if (reason === 'action') return this.current()?.label ?? '';
    this.clear();
    return '';
  }

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* rien à effacer */
    }
  }

  /**
   * Après une connexion réussie : exécute l'action en attente (s'il y en a une)
   * et renvoie l'adresse où retourner. Une action qui échoue (piste devenue
   * privée…) n'empêche pas la connexion.
   */
  async runAfterLogin(fallbackUrl: string): Promise<{ url: string; done: string | null }> {
    const pending = this.current();
    this.clear();
    await this.reactions.refresh();
    if (!pending) return { url: fallbackUrl, done: null };
    try {
      if (!this.reactions.has(pending.trackId, pending.type)) await firstValueFrom(this.reactions.toggle$(pending.trackId, pending.type));
      this.reactions.flash.set(`C’est fait : vous avez pu ${pending.label}.`);
      return { url: pending.returnUrl || fallbackUrl, done: pending.label };
    } catch (error) {
      console.warn('[PendingAction] Action non exécutée après connexion', error);
      this.reactions.flash.set('Vous êtes connecté, mais l’action demandée n’a pas pu être faite (la piste n’est peut-être plus accessible).');
      return { url: pending.returnUrl || fallbackUrl, done: null };
    }
  }
}
