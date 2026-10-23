import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrackTileComponent } from '../../components/track-tile/track-tile';
import { Track } from '../models/track.model';
import { DjEngineService } from './dj-engine.service';
import { MixService } from './mix.service';
import { SettingsService } from './settings.service';

const remix: Track = {
  id: 'm1',
  title: 'Mon remix',
  originalName: 'mix.webm',
  mimeType: 'audio/webm',
  size: 1,
  createdAt: '',
  kind: 'mix',
  credits: {
    remixBy: { id: 'a', name: 'Alice' },
    sources: [
      { trackId: 't1', title: 'Basse', ownerId: 'b', ownerName: 'Bob' },
      { trackId: 't2', title: 'Boucle', ownerId: 'a', ownerName: 'Alice' },
    ],
    external: [{ title: 'Libre', artist: 'Artiste CC', license: 'CC BY 4.0', sourceLabel: 'Jamendo', pageUrl: null }],
  },
};

describe('MOST VIBE étape 4 — mixages, paramètres', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('publie l’enregistrement en multipart avec titre, visibilité, style et durée', () => {
    const recording = new Blob(['audio'], { type: 'audio/webm' });
    TestBed.inject(MixService).publish('p1', recording, { title: 'Soirée', visibility: 'friends', style: 'afro', durationSeconds: 61.5 }).subscribe();
    const request = http.expectOne('/api/mixes/p1/publish');
    const body = request.request.body as FormData;
    expect(request.request.method).toBe('POST');
    expect([body.get('title'), body.get('visibility'), body.get('style'), body.get('durationSeconds')]).toEqual(['Soirée', 'friends', 'afro', '61.5']);
    expect((body.get('audio') as File).name).toBe('mix.webm');
    request.flush({});
  });

  it('crédits sur la carte : « Remix par… » et les auteurs d’origine, sans répéter le remixeur', () => {
    const tile = TestBed.createComponent(TrackTileComponent).componentInstance;
    expect(tile.sourceAuthors(remix)).toBe('Bob, Artiste CC');
    expect(tile.creditsText(remix)).toBe('Remix par Alice. Sources : « Basse » de Bob, « Boucle » de Alice, « Libre » de Artiste CC (CC BY 4.0).');
  });

  it('état du studio vide : aucune platine enregistrée', () => {
    const state = TestBed.inject(DjEngineService).captureState();
    expect(state.decks).toEqual({});
    expect(state.crossfader).toBe(0);
  });

  it('suppression du compte : mot de passe et confirmation dans le corps de la requête', () => {
    TestBed.inject(SettingsService).deleteAccount('secret123', 'SUPPRIMER').subscribe();
    const request = http.expectOne('/api/users/me');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ password: 'secret123', confirmation: 'SUPPRIMER' });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
