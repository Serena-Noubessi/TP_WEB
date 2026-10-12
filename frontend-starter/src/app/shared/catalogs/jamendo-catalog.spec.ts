import { afterEach, describe, expect, it, vi } from 'vitest';
import { JamendoCatalog } from './jamendo-catalog';
import { licenseLabel } from './music-catalog';

describe('licenseLabel', () => {
  it('transforme une URL Creative Commons en nom court', () => {
    expect(licenseLabel('http://creativecommons.org/licenses/by-nc-sa/3.0/')).toBe('CC BY-NC-SA 3.0');
    expect(licenseLabel('https://creativecommons.org/publicdomain/zero/1.0/')).toBe('CC0 (domaine public)');
    expect(licenseLabel('')).toBe('Licence non précisée');
  });
});

describe('JamendoCatalog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('demande une clé avant toute recherche', async () => {
    const catalog = new JamendoCatalog(() => '');
    expect(catalog.needsKey()).toBe(true);
    await expect(catalog.search('house', 1, new AbortController().signal)).rejects.toThrow(/clé client/);
  });

  it('envoie les bons paramètres et convertit la réponse', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        headers: { status: 'success', code: 0, error_message: '', results_count: 1 },
        results: [
          {
            id: '1532771',
            name: 'Morning Light',
            artist_name: 'Some Artist',
            duration: 201,
            audio: 'https://prod-1.storage.jamendo.com/?trackid=1532771&format=mp32',
            shareurl: 'https://www.jamendo.com/track/1532771',
            license_ccurl: 'http://creativecommons.org/licenses/by-sa/3.0/',
            image: 'https://usercontent.jamendo.com/img.jpg',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const page = await new JamendoCatalog(() => 'cle-de-test').search('house', 2, new AbortController().signal);

    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(new URL(url).origin + new URL(url).pathname).toBe('https://api.jamendo.com/v3.0/tracks/');
    expect(params.get('client_id')).toBe('cle-de-test');
    expect(params.get('search')).toBe('house');
    expect(params.get('offset')).toBe('10');
    expect(params.get('audioformat')).toBe('mp32');
    expect(init?.credentials).toBe('omit');
    expect(page.results[0]).toMatchObject({ title: 'Morning Light', artist: 'Some Artist', license: 'CC BY-SA 3.0', durationSeconds: 201 });
  });

  it('explique une clé refusée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      Response.json({ headers: { status: 'failed', code: 5, error_message: 'Invalid Client Id', results_count: 0 }, results: [] }),
    ));
    await expect(new JamendoCatalog(() => 'mauvaise').search('', 1, new AbortController().signal)).rejects.toThrow(/clé client Jamendo est refusée/);
  });
});
