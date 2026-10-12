import { describe, expect, it } from 'vitest';
import { readAudioTags } from '../audio/id3-reader';
import { categoryOf, categorySearch, displayTitle, findCategory, guessCategory, titleWithCategory } from './category.model';
import { Track } from './track.model';

const track = (title: string, online?: Track['online']): Track => ({
  id: '1', title, originalName: 'a.mp3', mimeType: 'audio/mpeg', size: 1, createdAt: '', online,
});

describe('catégories', () => {
  it('reconnaît la catégorie d’un dossier du générateur ou d’un genre ID3', () => {
    expect(guessCategory('01-house')?.id).toBe('house');
    expect(guessCategory('02-dance-house')?.id).toBe('dance-house');
    expect(guessCategory('05-hip-hop')?.id).toBe('hip-hop');
    expect(guessCategory('Autre / Trance')?.id).toBe('autre');
    expect(guessCategory('dance house mix')?.id).toBe('dance-house');
    expect(guessCategory('Jazz')).toBeUndefined();
  });

  it('écrit la catégorie en tête du titre et la retire à l’affichage', () => {
    const title = titleWithCategory('Stellar Rooftop', findCategory('house'));
    expect(title).toBe('[House] Stellar Rooftop');
    expect(displayTitle(track(title))).toBe('Stellar Rooftop');
    expect(categoryOf(track(title)).id).toBe('house');
    expect(titleWithCategory('[House] Stellar Rooftop', findCategory('techno'))).toBe('[Techno] Stellar Rooftop');
  });

  it('ne confond pas House et Dance House dans la recherche du backend', () => {
    const house = findCategory('house');
    expect(house && categorySearch(house)).toBe('[House]');
    expect('[Dance House] Cosmic Avenue'.includes('[House]')).toBe(false);
  });

  it('classe un ancien morceau sans préfixe en « Non classé » et un morceau en ligne selon sa fiche', () => {
    expect(categoryOf(track('song')).id).toBe('non-classe');
    expect(categoryOf(track('x', { category: 'pop' } as Track['online'])).id).toBe('pop');
  });
});

describe('readAudioTags', () => {
  it('lit le titre, le genre et le BPM d’une étiquette ID3v2.3 en UTF-16', async () => {
    const frame = (id: string, text: string) => {
      const body = new Uint8Array([1, 0xff, 0xfe, ...[...text].flatMap((char) => [char.charCodeAt(0), 0])]);
      const header = new Uint8Array(10);
      header.set([...id].map((char) => char.charCodeAt(0)));
      new DataView(header.buffer).setUint32(4, body.length);
      return [...header, ...body];
    };
    const frames = [...frame('TIT2', 'Stellar Rooftop'), ...frame('TCON', 'House'), ...frame('TBPM', '120')];
    const size = frames.length;
    const tag = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f, ...frames]);
    const tags = await readAudioTags(new Blob([tag, new Uint8Array(100)]));
    expect(tags).toEqual({ title: 'Stellar Rooftop', genre: 'House', bpm: 120 });
  });

  it('renvoie un objet vide sans étiquette ID3', async () => {
    expect(await readAudioTags(new Blob([new Uint8Array(20)]))).toEqual({});
  });
});
