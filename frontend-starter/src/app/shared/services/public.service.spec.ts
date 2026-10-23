import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PublicService } from './public.service';

describe('PublicService', () => {
  let service: PublicService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PublicService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('n’envoie que les filtres renseignés à la recherche publique', () => {
    service.search({ q: 'soleil', style: 'afro', author: '', album: '', tag: '', kind: '', sort: 'recent', page: 2, limit: 18 }).subscribe();
    const request = http.expectOne((req) => req.url === '/api/public/tracks');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual(['limit', 'page', 'q', 'sort', 'style']);
    expect(request.request.params.get('style')).toBe('afro');
    request.flush({ docs: [], totalDocs: 0, totalPages: 1 });
  });

  it('charge l’accueil public', () => {
    service.home().subscribe((home) => expect(home.recent).toEqual([]));
    http.expectOne('/api/public/home').flush({ recent: [], selection: [], mixes: [], albums: [], styles: {} });
  });
});
