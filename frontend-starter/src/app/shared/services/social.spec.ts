import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatDuration } from '../audio/duration';
import { NotificationBellComponent } from '../../components/notification-bell/notification-bell';
import { AuthService } from './auth.service';
import { CountersService } from './counters.service';
import { AppNotification, SocialService } from './social.service';

const TOKEN = `x.${btoa(JSON.stringify({ sub: 'u1' }))}.y`;

describe('MOST VIBE étape 3 — amis, messagerie, notifications', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    for (const request of http.match(() => true)) request.flush({ likes: [], favorites: [], messages: 0, notifications: 0, invitations: 0 });
    http.verify();
    localStorage.clear();
  });

  it('affiche une durée lisible', () => {
    expect(formatDuration(187)).toBe('3:07');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });

  it('compteurs : lus à la connexion, remis à zéro à la déconnexion', () => {
    const counters = TestBed.inject(CountersService);
    const auth = TestBed.inject(AuthService);
    auth.token.set(TOKEN);
    TestBed.tick();
    http.expectOne('/api/me/counters').flush({ messages: 2, notifications: 1, invitations: 3 });
    expect(counters.counters()).toEqual({ messages: 2, notifications: 1, invitations: 3 });
    auth.logout();
    TestBed.tick();
    expect(counters.counters()).toEqual({ messages: 0, notifications: 0, invitations: 0 });
  });

  it('envoie une piste dans une conversation (texte facultatif)', () => {
    TestBed.inject(SocialService).send('c1', { trackId: 't1' }).subscribe();
    const request = http.expectOne('/api/conversations/c1/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ trackId: 't1' });
    request.flush({ id: 'm1' });
  });

  it('la cloche décrit chaque notification en clair', () => {
    const bell = TestBed.createComponent(NotificationBellComponent).componentInstance;
    const base: AppNotification = { id: 'n', type: 'friend_request', actor: { id: 'a', name: 'Alice' }, count: 1, conversationId: null, track: null, read: false, at: new Date().toISOString() };
    expect(bell.describe(base)).toBe('Alice vous invite à devenir amis');
    expect(bell.describe({ ...base, type: 'friend_accepted' })).toBe('Alice a accepté votre invitation');
    expect(bell.describe({ ...base, type: 'track_shared', track: { id: 't', title: 'Soleil' } })).toBe('Alice a partagé « Soleil » avec vous');
    expect(bell.describe({ ...base, type: 'message', count: 3 })).toBe('Alice vous a envoyé 3 messages');
    expect(bell.ago(new Date().toISOString())).toBe('à l’instant');
  });
});
