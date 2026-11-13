import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computePeaks } from '../audio/waveform';
import { NotificationBellComponent } from '../../components/notification-bell/notification-bell';
import { WaveformComponent } from '../../components/waveform/waveform';
import { CommentsService } from './comments.service';
import { filenameFromDisposition } from './download.service';
import { LibraryService } from './library.service';
import { AppNotification, SocialService } from './social.service';
import { TrackService } from './track.service';

describe('MOST VIBE — forme d’onde, téléchargement, commentaires, abonnements, playlists partagées', () => {
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

  it('forme d’onde : une valeur par tranche, la plus forte vaut 100, aucune barre ne disparaît', () => {
    // 4 tranches de 32 échantillons : silence, moyen, fort, faible.
    const samples = new Float32Array(128);
    samples.fill(0.25, 32, 64);
    samples.fill(-0.5, 64, 96);
    samples.fill(0.05, 96, 128);
    expect(computePeaks([samples], 4)).toEqual([4, 50, 100, 10]);
    // Stéréo : on garde le plus fort des deux canaux.
    const right = new Float32Array(128).fill(0.5, 0, 32);
    expect(computePeaks([samples, right], 4)[0]).toBe(100);
    expect(computePeaks([new Float32Array(0)], 4)).toEqual([]);
  });

  it('composant forme d’onde : partie écoutée colorée et clic pour se déplacer', () => {
    const fixture = TestBed.createComponent(WaveformComponent);
    fixture.componentRef.setInput('peaks', [10, 20, 30, 40]);
    fixture.componentRef.setInput('progress', 0.5);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('rect').length).toBe(4);
    expect(element.querySelectorAll('rect.played').length).toBe(2);

    // Sans données : une simple ligne.
    fixture.componentRef.setInput('peaks', null);
    fixture.detectChanges();
    expect(element.querySelectorAll('rect.empty').length).toBe(1);

    const positions: number[] = [];
    fixture.componentInstance.seek.subscribe((value) => positions.push(value));
    const svg = element.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;
    svg.dispatchEvent(new MouseEvent('click', { clientX: 150 }));
    expect(positions).toEqual([]); // pas cliquable par défaut
    fixture.componentRef.setInput('seekable', true);
    fixture.detectChanges();
    svg.dispatchEvent(new MouseEvent('click', { clientX: 150 }));
    expect(positions).toEqual([0.25]);
  });

  it('envoie la forme d’onde avec la piste', () => {
    TestBed.inject(TrackService).upload(new File(['x'], 'a.mp3', { type: 'audio/mpeg' }), 'A', undefined, { waveform: [1, 50, 100] }).subscribe();
    const request = http.expectOne('/api/tracks');
    expect((request.request.body as FormData).get('waveform')).toBe('1,50,100');
    request.flush({});
  });

  it('téléchargement : nom du fichier lu dans Content-Disposition', () => {
    expect(filenameFromDisposition(`attachment; filename="Soleil.mp3"; filename*=UTF-8''Soleil%20lev%C3%A9.mp3`, 'x.mp3')).toBe('Soleil levé.mp3');
    expect(filenameFromDisposition('attachment; filename="Nuit.ogg"', 'x.mp3')).toBe('Nuit.ogg');
    expect(filenameFromDisposition(null, 'x.mp3')).toBe('x.mp3');
  });

  it('commentaires : lecture paginée, ajout et suppression', () => {
    const comments = TestBed.inject(CommentsService);
    comments.list('t1').subscribe();
    http.expectOne('/api/tracks/t1/comments').flush({ total: 0, hasMore: false, canComment: true, comments: [] });
    comments.list('t1', '2026-11-02T10:00:00.000Z').subscribe();
    http.expectOne((req) => req.url === '/api/tracks/t1/comments' && req.params.get('before') === '2026-11-02T10:00:00.000Z').flush({ total: 0, hasMore: false, canComment: true, comments: [] });
    comments.add('t1', 'Super !').subscribe();
    const post = http.expectOne('/api/tracks/t1/comments');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ text: 'Super !' });
    post.flush({});
    comments.remove('c1').subscribe();
    expect(http.expectOne('/api/comments/c1').request.method).toBe('DELETE');
  });

  it('abonnements et partage de playlist : bonnes routes', () => {
    const social = TestBed.inject(SocialService);
    social.follow('u2').subscribe();
    expect(http.expectOne('/api/users/u2/follow').request.method).toBe('POST');
    social.unfollow('u2').subscribe();
    expect(http.expectOne('/api/users/u2/follow').request.method).toBe('DELETE');
    const library = TestBed.inject(LibraryService);
    library.sharePlaylist('p1', ['u2']).subscribe();
    const share = http.expectOne('/api/playlists/p1/share');
    expect(share.request.body).toEqual({ userIds: ['u2'] });
    share.flush({});
    library.unsharePlaylist('p1', 'u2').subscribe();
    expect(http.expectOne('/api/playlists/p1/share/u2').request.method).toBe('DELETE');
  });

  it('notifications : nouveaux types, textes et destinations', () => {
    const bell = TestBed.createComponent(NotificationBellComponent).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const base: AppNotification = { id: 'n', type: 'comment', actor: { id: 'a', name: 'Alice' }, count: 1, conversationId: null, track: { id: 't', title: 'Soleil' }, read: false, at: new Date().toISOString() };
    expect(bell.describe(base)).toBe('Alice a commenté « Soleil »');
    expect(bell.describe({ ...base, type: 'follow' })).toBe('Alice s’est abonné(e) à vos créations');
    expect(bell.describe({ ...base, type: 'new_release' })).toBe('Alice a publié « Soleil »');
    expect(bell.describe({ ...base, type: 'playlist_shared', playlist: { id: 'p', name: 'Été' } })).toBe('Alice a partagé la playlist « Été » avec vous');
    bell.go(base);
    expect(navigate).toHaveBeenLastCalledWith(['/t', 't'], { fragment: 'comments' });
    bell.go({ ...base, type: 'follow' });
    expect(navigate).toHaveBeenLastCalledWith(['/u', 'a']);
    bell.go({ ...base, type: 'playlist_shared', playlist: { id: 'p', name: 'Été' } });
    expect(navigate).toHaveBeenLastCalledWith(['/p', 'p']);
  });
});
