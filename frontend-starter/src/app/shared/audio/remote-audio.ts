import { OnlineAudioError } from './online-audio-error';

/** Taille maximale d'un fichier en ligne : il est gardé entier en mémoire pour être décodé. */
export const MAX_ONLINE_BYTES = 60 * 1024 * 1024;
/** Sans aucune donnée reçue pendant ce délai, le téléchargement est abandonné. */
export const STALL_TIMEOUT_MS = 20000;

/**
 * Services de streaming dont les morceaux sont protégés par le droit d'auteur :
 * leurs liens sont refusés, l'application ne télécharge que des fichiers libres.
 */
const PROTECTED_HOSTS = ['youtube.com', 'youtu.be', 'spotify.com', 'deezer.com', 'soundcloud.com', 'music.apple.com', 'tidal.com', 'music.amazon.'];

export interface DownloadProgress {
  loaded: number;
  /** Taille annoncée par le serveur, ou null si elle est inconnue. */
  total: number | null;
  /** Débit moyen en octets par seconde. */
  bytesPerSecond: number;
}

/** Vérifie qu'un texte est une adresse web utilisable et l'analyse. */
export function parseAudioUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new OnlineAudioError('invalid-url', 'Ce lien n’est pas une adresse web valide. Il doit commencer par https:// (ou http://).');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new OnlineAudioError('invalid-url', 'Seuls les liens web (https:// ou http://) sont acceptés.');
  }
  const host = url.hostname.toLowerCase();
  if (PROTECTED_HOSTS.some((protectedHost) => host === protectedHost || host.endsWith(`.${protectedHost}`) || host.includes(protectedHost))) {
    throw new OnlineAudioError(
      'protected-service',
      `${url.hostname} diffuse des morceaux protégés par le droit d’auteur : l’application ne les télécharge pas. Utilisez le lien direct d’un fichier libre (.mp3, .ogg, .wav…) ou le catalogue Jamendo.`,
    );
  }
  return url;
}

/**
 * Télécharge un fichier audio en mémoire, avec progression, délai d'inactivité
 * et diagnostic précis des échecs (CORS, serveur injoignable, erreur HTTP…).
 * `fetch` est utilisé à la place du client HTTP d'Angular pour que le jeton de
 * connexion de l'application ne soit jamais envoyé à un site extérieur.
 */
export async function downloadAudio(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
  externalSignal?: AbortSignal,
): Promise<Blob> {
  const controller = new AbortController();
  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const armStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, STALL_TIMEOUT_MS);
  };
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);
  /** Si l'échec vient d'une annulation ou d'une connexion trop lente, le signale ; sinon ne fait rien. */
  const throwIfAborted = (): void => {
    if (externalSignal?.aborted) throw new OnlineAudioError('cancelled', 'Téléchargement annulé.');
    if (stalled) {
      throw new OnlineAudioError('slow', `Connexion trop lente : aucune donnée reçue depuis ${STALL_TIMEOUT_MS / 1000} secondes. Réessayez plus tard ou avec une meilleure connexion.`);
    }
  };
  const interrupted = (): OnlineAudioError =>
    new OnlineAudioError('unreachable', 'Le téléchargement a été interrompu. Vérifiez votre connexion et réessayez.');

  try {
    armStallTimer();
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    } catch {
      throwIfAborted();
      throw await diagnoseNetworkFailure(url);
    }

    if (!response.ok) {
      const reasons: Record<number, string> = {
        401: 'ce fichier demande une connexion',
        403: 'le serveur refuse l’accès à ce fichier',
        404: 'le fichier est introuvable (lien cassé ou déplacé)',
        410: 'le fichier a été supprimé',
        429: 'le serveur reçoit trop de demandes, réessayez dans un moment',
      };
      const reason = reasons[response.status] ?? (response.status >= 500 ? 'le serveur rencontre un problème' : 'la demande a été refusée');
      throw new OnlineAudioError('http', `Téléchargement impossible : ${reason} (code HTTP ${response.status}).`);
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.startsWith('text/html') || contentType.startsWith('application/json')) {
      throw new OnlineAudioError(
        'not-audio',
        'Ce lien mène à une page web et non à un fichier audio. Ouvrez la page, puis copiez le lien direct du fichier (il se termine souvent par .mp3, .ogg ou .wav).',
      );
    }
    const announced = Number(response.headers.get('content-length')) || null;
    if (announced && announced > MAX_ONLINE_BYTES) {
      throw new OnlineAudioError('too-large', `Fichier trop volumineux (${Math.round(announced / 1048576)} Mo) : la limite est de ${MAX_ONLINE_BYTES / 1048576} Mo.`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const blob = await response.blob().catch(() => {
        throwIfAborted();
        throw interrupted();
      });
      onProgress({ loaded: blob.size, total: blob.size, bytesPerSecond: 0 });
      return blob;
    }
    const chunks: BlobPart[] = [];
    const started = performance.now();
    let loaded = 0;
    for (;;) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        throwIfAborted();
        throw interrupted();
      }
      if (result.done) break;
      armStallTimer();
      chunks.push(result.value as Uint8Array<ArrayBuffer>);
      loaded += result.value.byteLength;
      if (loaded > MAX_ONLINE_BYTES) {
        controller.abort();
        throw new OnlineAudioError('too-large', `Fichier trop volumineux : la limite est de ${MAX_ONLINE_BYTES / 1048576} Mo.`);
      }
      const seconds = (performance.now() - started) / 1000;
      onProgress({ loaded, total: announced, bytesPerSecond: seconds > 0 ? loaded / seconds : 0 });
    }
    return new Blob(chunks, { type: contentType || 'application/octet-stream' });
  } finally {
    clearTimeout(stallTimer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Un `fetch` qui échoue ne dit pas pourquoi. On relance une requête en mode
 * « no-cors » : si le serveur répond, il est joignable et c'est donc la règle
 * CORS qui bloque ; sinon le serveur est injoignable.
 */
async function diagnoseNetworkFailure(url: string): Promise<OnlineAudioError> {
  const host = new URL(url).hostname;
  const probe = new AbortController();
  const timer = setTimeout(() => probe.abort(), 8000);
  try {
    await fetch(url, { mode: 'no-cors', signal: probe.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!/\.(mp3|ogg|oga|opus|wav|m4a|aac|flac|webm)$/i.test(new URL(url).pathname)) {
      return new OnlineAudioError(
        'not-audio',
        `Ce lien ne semble pas mener à un fichier audio : c’est probablement une page web de ${host}. Ouvrez la page, puis copiez le lien direct du fichier (il se termine souvent par .mp3, .ogg ou .wav).`,
      );
    }
    return new OnlineAudioError(
      'cors',
      `Le serveur ${host} répond, mais il n’autorise pas les autres sites à télécharger ce fichier (règle de sécurité CORS du navigateur). ` +
        'Le morceau ne peut donc pas être chargé sur les decks depuis ce lien. Solution possible : passer par un petit serveur intermédiaire (non installé pour l’instant).',
    );
  } catch {
    return new OnlineAudioError('unreachable', `Impossible de joindre ${host}. Vérifiez le lien et votre connexion internet.`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Vérifie que le navigateur sait décoder le fichier, exactement comme le fera
 * le moteur des decks (decodeAudioData), et renvoie sa durée en secondes.
 */
export async function checkDecodable(blob: Blob): Promise<number> {
  try {
    const context = new OfflineAudioContext(1, 1, 44100);
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    return buffer.duration;
  } catch {
    throw new OnlineAudioError(
      'unsupported-format',
      'Ce fichier n’est pas dans un format audio lisible par le navigateur. Formats acceptés : MP3, OGG, WAV, M4A/AAC, FLAC.',
    );
  }
}
