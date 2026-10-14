import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Track } from '../models/track.model';
import { AudioPlayerService } from './audio-player.service';
import { AuthService } from './auth.service';
import { TrackService } from './track.service';

const track = (id: string): Track => ({ id, title: `[House] Morceau ${id}`, originalName: `${id}.mp3`, mimeType: 'audio/mpeg', size: 1, createdAt: '' });

describe('AudioPlayerService', () => {
  let player: AudioPlayerService;
  const token = signal<string | null>('jeton');

  beforeEach(() => {
    localStorage.clear();
    token.set('jeton');
    // jsdom ne sait pas lire de l'audio : lecture et pause sont simulées.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    // jsdom ne sait pas non plus créer d'URL temporaire pour un fichier : simulée elle aussi.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: TrackService, useValue: { audio: vi.fn(() => of(new Blob(['x'], { type: 'audio/mpeg' }))) } },
        { provide: AuthService, useValue: { token } },
      ],
    });
    player = TestBed.inject(AudioPlayerService);
    // Liste de 3 morceaux sans passer par Web Audio (absent de jsdom).
    player.queue.set([track('a'), track('b'), track('c')]);
    player.index.set(0);
  });

  afterEach(() => vi.restoreAllMocks());

  it('limite la vitesse entre 0,5× et 2× et la retient', () => {
    player.setRate(3);
    expect(player.rate()).toBe(2);
    player.setRate(0.1);
    expect(player.rate()).toBe(0.5);
    player.setRate(1.25);
    expect(JSON.parse(localStorage.getItem('gpc_audio_player') ?? '{}').rate).toBe(1.25);
  });

  it('borne le volume et retire le mode muet quand on remonte le volume', () => {
    player.toggleMute();
    expect(player.muted()).toBe(true);
    player.setVolume(1.4);
    expect(player.volume()).toBe(1);
    expect(player.muted()).toBe(false);
  });

  it('passe de « répéter la liste » à « répéter le morceau » puis « pas de répétition »', () => {
    expect(player.repeat()).toBe('all');
    player.cycleRepeat();
    expect(player.repeat()).toBe('one');
    player.cycleRepeat();
    expect(player.repeat()).toBe('off');
  });

  it('enchaîne les morceaux et revient au début en répétition de liste', () => {
    player.next();
    expect(player.current()?.id).toBe('b');
    player.next();
    player.next();
    expect(player.current()?.id).toBe('a');
  });

  it('s’arrête en fin de liste sans répétition', () => {
    player.repeat.set('off');
    player.index.set(2);
    player.next(true);
    expect(player.current()?.id).toBe('c');
    expect(player.playing()).toBe(false);
  });

  it('« précédent » recommence le morceau après 3 secondes', () => {
    player.index.set(1);
    player.time.set(10);
    player.previous();
    expect(player.current()?.id).toBe('b');
    player.time.set(1);
    player.previous();
    expect(player.current()?.id).toBe('a');
  });

  it('arrête tout à la déconnexion', () => {
    token.set(null);
    TestBed.tick();
    expect(player.queue()).toEqual([]);
    expect(player.current()).toBeNull();
  });
});
