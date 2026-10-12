import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnlineAudioError } from './online-audio-error';
import { downloadAudio, parseAudioUrl } from './remote-audio';

const noProgress = () => undefined;

async function failure(promise: Promise<unknown>): Promise<OnlineAudioError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof OnlineAudioError) return error;
    throw error;
  }
  throw new Error('Une erreur était attendue');
}

describe('parseAudioUrl', () => {
  it('refuse un texte qui n’est pas une adresse web', () => {
    expect(() => parseAudioUrl('pas un lien')).toThrowError(/adresse web valide/);
    expect(() => parseAudioUrl('ftp://exemple.org/a.mp3')).toThrowError(/https/);
  });

  it('refuse les services de musique protégée', () => {
    for (const url of ['https://www.youtube.com/watch?v=abc', 'https://youtu.be/abc', 'https://open.spotify.com/track/1']) {
      expect(() => parseAudioUrl(url)).toThrowError(/droit d’auteur/);
    }
  });

  it('accepte un lien direct vers un fichier', () => {
    expect(parseAudioUrl(' https://upload.wikimedia.org/a.ogg ').hostname).toBe('upload.wikimedia.org');
  });
});

describe('downloadAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('explique une erreur HTTP 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const error = await failure(downloadAudio('https://exemple.org/a.mp3', noProgress));
    expect(error.kind).toBe('http');
    expect(error.message).toContain('introuvable');
  });

  it('détecte un lien vers une page web au lieu d’un fichier audio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })));
    const error = await failure(downloadAudio('https://exemple.org/page', noProgress));
    expect(error.kind).toBe('not-audio');
  });

  it('distingue un blocage CORS d’un serveur injoignable', async () => {
    const corsFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.mode === 'no-cors') return new Response(null, { status: 200 });
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', corsFetch);
    expect((await failure(downloadAudio('https://bloque.example/a.mp3', noProgress))).kind).toBe('cors');
    expect((await failure(downloadAudio('https://bloque.example/une-page', noProgress))).kind).toBe('not-audio');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect((await failure(downloadAudio('https://absent.example/a.mp3', noProgress))).kind).toBe('unreachable');
  });

  it('abandonne une connexion qui ne reçoit plus rien', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = failure(downloadAudio('https://lent.example/a.mp3', noProgress));
    await vi.advanceTimersByTimeAsync(21000);
    const error = await pending;
    expect(error.kind).toBe('slow');
  });

  it('télécharge le fichier et signale la progression', async () => {
    const bytes = new Uint8Array(1000);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'content-length': '1000' } })));
    const progress = vi.fn();
    const blob = await downloadAudio('https://exemple.org/a.mp3', progress);
    expect(blob.size).toBe(1000);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ loaded: 1000, total: 1000 }));
  });
});
