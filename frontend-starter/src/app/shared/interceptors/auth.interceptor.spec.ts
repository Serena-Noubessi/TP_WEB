import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, authErrorMessage } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('Section 11 — session expirée et messages de connexion', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('401 sur une requête authentifiée : déconnexion et retour à la connexion avec la raison', () => {
    const auth = TestBed.inject(AuthService);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.token.set('jeton-expire');
    TestBed.inject(HttpClient).get('/api/playlists').subscribe({ error: () => undefined });
    const request = http.expectOne('/api/playlists');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jeton-expire');
    request.flush({ message: 'Jeton invalide ou expiré' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.token()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired', returnUrl: '/' } });
  });

  it('compte suspendu : raison « suspended »', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(AuthService).token.set('jeton');
    TestBed.inject(HttpClient).get('/api/friends').subscribe({ error: () => undefined });
    http.expectOne('/api/friends').flush({ message: 'Ce compte est suspendu ou n’existe plus' }, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'suspended', returnUrl: '/' } });
  });

  it('un échec de connexion (identifiants) ne déconnecte personne et ne redirige pas', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(HttpClient).post('/api/auth/login', {}).subscribe({ error: () => undefined });
    http.expectOne('/api/auth/login').flush({ message: 'Identifiants incorrects' }, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('messages de connexion précis', () => {
    expect(authErrorMessage({ status: 0 }, 'login')).toMatch(/serveur ne répond pas/);
    expect(authErrorMessage({ status: 502 }, 'login')).toMatch(/serveur ne répond pas/);
    expect(authErrorMessage({ status: 401, error: { message: 'Identifiants incorrects' } }, 'login')).toBe('Email ou mot de passe incorrect.');
    expect(authErrorMessage({ status: 403, error: { message: 'Ce compte est suspendu : spam' } }, 'login')).toBe('Ce compte est suspendu : spam');
    expect(authErrorMessage({ status: 409, error: { message: 'Email déjà utilisé' } }, 'register')).toBe('Email déjà utilisé');
  });
});
