import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Ajoute le jeton aux requêtes de l'API.
 * MOST VIBE (section 11) : si une requête envoyée AVEC un jeton reçoit 401
 * (session expirée au bout de 2 h, compte suspendu ou supprimé), l'utilisateur
 * est déconnecté proprement et renvoyé à la connexion avec une explication,
 * puis ramené à sa page après s'être reconnecté.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const document = inject(DOCUMENT);
  const token = auth.token();
  const isAuthCall = request.url.startsWith('/api/auth/');

  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request).pipe(
    catchError((error: unknown) => {
      // Le jeton a pu changer entre-temps (reconnexion) : on ne déconnecte que si c'est encore le même.
      if (error instanceof HttpErrorResponse && error.status === 401 && token && !isAuthCall && auth.token() === token) {
        const serverMessage = typeof error.error === 'object' && error.error !== null ? (error.error as { message?: string }).message : undefined;
        const reason = serverMessage?.includes('suspendu') ? 'suspended' : 'expired';
        console.warn(`[Auth] Session terminée (${reason}) : retour à la connexion`);
        auth.logout();
        // Page à retrouver après la reconnexion. Au démarrage, le 401 arrive PENDANT la
        // navigation initiale (router.url vaut encore « / ») : on prend alors l'adresse
        // de la navigation en cours, ou à défaut celle de la barre d'adresse.
        const target = router.getCurrentNavigation()?.finalUrl?.toString() ?? `${document.location.pathname}${document.location.search}`;
        if (!target.startsWith('/login')) {
          void router.navigate(['/login'], { queryParams: { reason, returnUrl: target } });
        }
      }
      return throwError(() => error);
    }),
  );
};
