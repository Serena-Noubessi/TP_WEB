import { checkDecodable } from './remote-audio';

/** Formats audio acceptés tels quels (identiques à la liste du serveur). */
export const ALLOWED_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']);

/**
 * Fichiers MPEG annoncés autrement que « audio/mpeg » : Windows donne souvent
 * « video/mpeg » à un fichier .mpeg ou .mpg, même quand il ne contient que du son.
 */
const MPEG_TYPES = new Set(['video/mpeg', 'audio/mpg', 'audio/x-mpeg', 'audio/mp3', 'audio/x-mp3', 'audio/mpeg3', 'audio/x-mpeg-3', 'audio/mpga']);
const MPEG_EXTENSIONS = /\.(mpe?g|mpga|mp2|mpa)$/i;

/** Valeur de l'attribut « accept » des sélecteurs de fichiers : l'audio, plus les fichiers MPEG. */
export const AUDIO_ACCEPT = 'audio/*,video/mpeg,.mpeg,.mpg,.mpga,.mp2,.mpa';

export const AUDIO_FORMATS_LABEL = 'MP3, MPEG (son seulement), WAV, OGG ou M4A';

/** Fichier MPEG à vérifier avant l'envoi (son lisible ou non par le navigateur). */
export function isMpegVariant(file: File): boolean {
  if (ALLOWED_AUDIO_TYPES.has(file.type)) return false;
  return MPEG_TYPES.has(file.type) || (!file.type && MPEG_EXTENSIONS.test(file.name)) || (file.type === 'video/mpeg' && MPEG_EXTENSIONS.test(file.name));
}

/** Fichier accepté au premier coup d'œil (son format exact est vérifié ensuite pour un MPEG). */
export function isAcceptedAudio(file: File): boolean {
  return ALLOWED_AUDIO_TYPES.has(file.type) || isMpegVariant(file);
}

/**
 * Prépare un fichier pour l'envoi. Un fichier MPEG n'est accepté que si le
 * navigateur arrive à en lire le son (c'est le cas d'un MPEG audio). Il est
 * alors envoyé comme « audio/mpeg », pour que la lecture fonctionne partout.
 * Une vidéo MPEG (que Chrome ne sait pas lire) est refusée avec un message clair.
 */
export async function prepareAudioFile(file: File): Promise<File> {
  if (!isMpegVariant(file)) return file;
  try {
    await checkDecodable(file);
  } catch {
    throw new Error(
      `« ${file.name} » est un fichier MPEG dont le son ne peut pas être lu par le navigateur (c’est souvent une vidéo MPEG). ` +
        'Convertissez-le en MP3, par exemple avec VLC ou Audacity, puis envoyez le MP3.',
    );
  }
  return new File([file], file.name, { type: 'audio/mpeg', lastModified: file.lastModified });
}
