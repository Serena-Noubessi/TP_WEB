import { describe, expect, it } from 'vitest';
import { readAudioTags } from '../audio/id3-reader';
import { CATEGORIES, categoryOf, displayTitle, findCategory, guessCategory } from './category.model';
import { Track } from './track.model';

const track = (fields: Partial<Track>): Track => ({
  id: '1', title: 'x', originalName: 'a.mp3', mimeType: 'audio/mpeg', size: 1, createdAt: '', ...fields,
});

describe('styles MOST VIBE', () => {
  it('propose exactement les 8 styles (les 7 de la mission + Dance), identiques au backend', () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual(['hip-hop', 'afro', 'electro', 'pop', 'jazz', 'rock', 'dance', 'autres']);
  });

  it('regroupe les anciens genres selon la décision du 14/10/2026', () => {
    expect(guessCategory('01-house')?.id).toBe('electro');
    expect(guessCategory('02-dance-house')?.id).toBe('dance');
    expect(guessCategory('Eurodance')?.id).toBe('dance');
    expect(guessCategory('Techno')?.id).toBe('electro');
    expect(guessCategory('dubstep')?.id).toBe('electro');
    expect(guessCategory('05-hip-hop')?.id).toBe('hip-hop');
    expect(guessCategory('Autre / Trance')?.id).toBe('autres');
    expect(guessCategory('Afro House')?.id).toBe('afro');
    expect(guessCategory('Classique')).toBeUndefined();
  });

  it('lit le style dans le champ style, sinon dans la fiche en ligne (anciens identifiants convertis)', () => {
    expect(categoryOf(track({ style: 'jazz' })).id).toBe('jazz');
    expect(categoryOf(track({ style: 'inconnu' })).id).toBe('autres');
    expect(categoryOf(track({ online: { category: 'dance-house' } as Track['online'] })).id).toBe('dance');
    expect(categoryOf(track({})).id).toBe('autres');
    expect(findCategory('rock')?.label).toBe('Rock');
  });

  it('retire un éventuel ancien préfixe du titre à l’affichage', () => {
    expect(displayTitle(track({ title: '[House] Stellar Rooftop' }))).toBe('Stellar Rooftop');
    expect(displayTitle(track({ title: 'Stellar Rooftop' }))).toBe('Stellar Rooftop');
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
