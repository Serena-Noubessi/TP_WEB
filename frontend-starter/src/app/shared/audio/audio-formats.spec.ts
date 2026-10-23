import { describe, expect, it } from 'vitest';
import { isAcceptedAudio, isMpegVariant, prepareAudioFile } from './audio-formats';

const file = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });

describe('formats audio acceptés (dont MPEG)', () => {
  it('reconnaît les fichiers MPEG annoncés comme vidéo par Windows', () => {
    expect(isMpegVariant(file('concert.mpeg', 'video/mpeg'))).toBe(true);
    expect(isMpegVariant(file('son.mpg', ''))).toBe(true);
    expect(isMpegVariant(file('voix.mp3', 'audio/mpeg'))).toBe(false);
    expect(isAcceptedAudio(file('concert.mpeg', 'video/mpeg'))).toBe(true);
    expect(isAcceptedAudio(file('voix.mp3', 'audio/mpeg'))).toBe(true);
  });

  it('refuse les autres vidéos et les fichiers non audio', () => {
    expect(isAcceptedAudio(file('film.mp4', 'video/mp4'))).toBe(false);
    expect(isAcceptedAudio(file('photo.png', 'image/png'))).toBe(false);
  });

  it('un MP3 ordinaire est envoyé tel quel', async () => {
    const mp3 = file('voix.mp3', 'audio/mpeg');
    expect(await prepareAudioFile(mp3)).toBe(mp3);
  });

  it('un MPEG dont le son est illisible est refusé avec un message qui dit quoi faire', async () => {
    await expect(prepareAudioFile(file('film.mpeg', 'video/mpeg'))).rejects.toThrow(/Convertissez-le en MP3/);
  });
});
