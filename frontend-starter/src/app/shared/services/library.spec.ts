import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { OnlineTrackService } from './online-track.service';
import { PendingActionService, safeReturnUrl } from './pending-action.service';
import { ReactionsService } from './reactions.service';

/** Jeton factice (non signé) dont le champ sub vaut « u1 ». */
const TOKEN = `x.${btoa(JSON.stringify({ sub: 'u1' }))}.y`;

describe('MOST VIBE étape 2 — services de la bibliothèque', () => {
  let http: HttpTestingController;

  /** Répond à toutes les lectures des réactions en attente (déclenchées par l'arrivée du jeton). */
  const flushReactions = () => {
    for (const request of http.match('/api/me/reactions')) request.flush({ likes: [], favorites: [] });
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    flushReactions();
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('n’accepte comme page de retour qu’une adresse interne', () => {
    expect(safeReturnUrl('/explore?q=afro')).toBe('/explore?q=afro');
    expect(safeReturnUrl('https://exemple.com')).toBeNull();
    expect(safeReturnUrl('//exemple.com')).toBeNull();
    expect(safeReturnUrl('/login')).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
  });

  it('visiteur : l’action est mémorisée, puis exécutée après la connexion', async () => {
    const pending = TestBed.inject(PendingActionService);
    const reactions = TestBed.inject(ReactionsService);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    pending.requireLogin({ type: 'like', trackId: 't1', label: 'aimer « Soleil »' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/', reason: 'action' } });
    expect(pending.labelFor('action')).toBe('aimer « Soleil »');

    // Connexion : le jeton arrive, puis la page de connexion lance l'action en attente.
    TestBed.inject(AuthService).token.set(TOKEN);
    const done = pending.runAfterLogin('/tracks');
    // Le ReactionsService relit les réactions (effet du jeton + relecture explicite), puis l'action part.
    const like = await vi.waitFor(() => {
      flushReactions();
      return http.expectOne('/api/tracks/t1/like');
    });
    like.flush({ trackId: 't1', type: 'like', active: true, likeCount: 4 });
    const result = await done;

    expect(result).toEqual({ url: '/', done: 'aimer « Soleil »' });
    expect(reactions.likes().has('t1')).toBe(true);
    expect(reactions.likeCounts().get('t1')).toBe(4);
    expect(pending.current()).toBeNull();
  });

  it('une action ancienne est oubliée si l’on ouvre la connexion sans venir d’une action', () => {
    const pending = TestBed.inject(PendingActionService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    pending.requireLogin({ type: 'favorite', trackId: 't2', label: 'ajouter aux favoris' });
    expect(pending.labelFor(null)).toBe('');
    expect(pending.current()).toBeNull();
  });

  it('j’aime : affichage immédiat, annulé si le serveur refuse', () => {
    const reactions = TestBed.inject(ReactionsService);
    reactions.toggle$('t3', 'like').subscribe({ error: () => undefined });
    expect(reactions.likes().has('t3')).toBe(true);
    http.expectOne('/api/tracks/t3/like').flush({ message: 'Vous n’avez pas accès à cette piste' }, { status: 403, statusText: 'Forbidden' });
    expect(reactions.likes().has('t3')).toBe(false);
  });

  it('une relecture lancée pendant un j’aime ne l’efface pas (défaut trouvé au test navigateur)', async () => {
    const reactions = TestBed.inject(ReactionsService);
    TestBed.inject(AuthService).token.set(TOKEN);
    reactions.toggle$('t4', 'like').subscribe();
    const reread = reactions.refresh();
    http.expectOne('/api/tracks/t4/like').flush({ trackId: 't4', type: 'like', active: true, likeCount: 1 });
    // Le serveur a lu l'état AVANT d'enregistrer le j'aime : réponse périmée.
    for (const request of http.match('/api/me/reactions')) request.flush({ likes: [], favorites: [] });
    await reread;
    expect(reactions.likes().has('t4')).toBe(true);
  });

  it('morceaux en ligne : l’ancienne liste du navigateur est envoyée une fois au serveur puis effacée', async () => {
    const legacy = [{ id: 'online-1', title: 'Libre', originalName: 'l.mp3', mimeType: 'audio/mpeg', size: 1, createdAt: '', online: { audioUrl: 'https://ex.org/l.mp3', artist: 'A', sourceId: 'url', sourceLabel: 'ex.org', pageUrl: null, license: 'CC', licenseUrl: null, imageUrl: null, durationSeconds: 3, category: 'house' } }];
    localStorage.setItem('gpc_online_tracks_u1', JSON.stringify(legacy));
    const service = TestBed.inject(OnlineTrackService);
    TestBed.inject(AuthService).token.set(TOKEN);
    TestBed.tick();
    flushReactions();

    const migration = await vi.waitFor(() => http.expectOne((req) => req.method === 'POST' && req.url === '/api/external-tracks'));
    expect(migration.request.body.items[0]).toMatchObject({ title: 'Libre', audioUrl: 'https://ex.org/l.mp3', style: 'electro' });
    migration.flush({ docs: [{ id: 'srv1' }], rejected: [] });
    await vi.waitFor(() => http.expectOne((req) => req.method === 'GET' && req.url === '/api/external-tracks').flush({ docs: [{ ...legacy[0], id: 'srv1' }] }));
    await vi.waitFor(() => expect(service.tracks().map((track) => track.id)).toEqual(['srv1']));
    expect(localStorage.getItem('gpc_online_tracks_u1')).toBeNull();
  });
});
