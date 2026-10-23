import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { AuthResponse } from '../models/auth-response.model';
import { User } from '../models/user.model';

/** Handles authentication and the current user's profile. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<User | null>(null);
  readonly token = signal<string | null>(localStorage.getItem('gpc_token'));
  /** Identifiant du compte connecté, lu dans le jeton (champ « sub »), ou null. */
  readonly userId = computed(() => subjectOf(this.token()));
  /** Vrai si le compte connecté est administrateur (le serveur revérifie à chaque requête). */
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  register(name: string, email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/register', { name, email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  profile() {
    return this.http
      .get<User>('/api/users/me')
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  update(name: string) {
    return this.http
      .put<User>('/api/users/me', { name })
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  logout(): void {
    localStorage.removeItem('gpc_token');
    this.token.set(null);
    this.currentUser.set(null);
  }

  private storeAuthentication(response: AuthResponse): void {
    localStorage.setItem('gpc_token', response.token);
    this.token.set(response.token);
    this.currentUser.set(response.user);
  }
}

/**
 * Message clair pour un échec de connexion ou d'inscription : serveur injoignable,
 * identifiants incorrects, compte suspendu (le serveur donne la raison), etc.
 */
export function authErrorMessage(error: unknown, action: 'login' | 'register'): string {
  const response = error as { status?: number; error?: { message?: string } | string };
  const serverMessage = typeof response?.error === 'object' && response.error !== null ? response.error.message : undefined;
  switch (response?.status) {
    case 0:
    case 502:
    case 503:
    case 504:
      return 'Le serveur ne répond pas : vérifiez votre connexion internet, ou que le backend est bien démarré, puis réessayez.';
    case 401:
      return 'Email ou mot de passe incorrect.';
    case 403:
      return serverMessage ?? 'Ce compte ne peut pas se connecter pour le moment.';
    case 409:
      return serverMessage ?? 'Cet email est déjà utilisé : connectez-vous plutôt.';
    case 400:
      return serverMessage ?? 'Vérifiez les champs du formulaire.';
    default:
      return serverMessage ?? (action === 'login' ? 'La connexion a échoué. Réessayez dans un instant.' : 'L’inscription a échoué. Réessayez dans un instant.');
  }
}

function subjectOf(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
