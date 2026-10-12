/** Informations lues dans l'étiquette ID3 d'un MP3 (celles écrites par le générateur, ou par d'autres logiciels). */
export interface AudioTags {
  title?: string;
  artist?: string;
  genre?: string;
  bpm?: number;
}

const FRAMES: Record<string, keyof AudioTags> = { TIT2: 'title', TPE1: 'artist', TCON: 'genre', TBPM: 'bpm' };

/**
 * Lit les champs texte principaux d'une étiquette ID3v2.3 ou ID3v2.4, au début du fichier.
 * Ne lit que les premiers kilo-octets : rapide même pour un dossier de centaines de fichiers.
 */
export async function readAudioTags(file: Blob): Promise<AudioTags> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
  const version = head[3];
  const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
  const bytes = new Uint8Array(await file.slice(10, 10 + Math.min(size, 64 * 1024)).arrayBuffer());
  const tags: AudioTags = {};

  let offset = 0;
  while (offset + 10 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const frameSize =
      version === 4
        ? ((bytes[offset + 4] & 0x7f) << 21) | ((bytes[offset + 5] & 0x7f) << 14) | ((bytes[offset + 6] & 0x7f) << 7) | (bytes[offset + 7] & 0x7f)
        : (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
    const body = bytes.subarray(offset + 10, offset + 10 + frameSize);
    const field = FRAMES[id];
    if (field && body.length > 1) {
      const text = decodeText(body);
      if (field === 'bpm') {
        const bpm = Number.parseFloat(text);
        if (Number.isFinite(bpm) && bpm > 0) tags.bpm = bpm;
      } else if (text) {
        tags[field] = text;
      }
    }
    offset += 10 + frameSize;
  }
  return tags;
}

/** Premier octet = encodage : 0 Latin-1, 1 UTF-16 avec BOM, 2 UTF-16BE, 3 UTF-8. */
function decodeText(body: Uint8Array): string {
  const content = body.subarray(1);
  const encoding = ['latin1', 'utf-16', 'utf-16be', 'utf-8'][body[0]] ?? 'latin1';
  try {
    return new TextDecoder(encoding).decode(content).replace(/\0+$/g, '').replace(/^﻿/, '').trim();
  } catch {
    return '';
  }
}
