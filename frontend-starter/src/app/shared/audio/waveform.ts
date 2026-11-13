/** Nombre de barres d'une forme d'onde (identique pour toutes les pistes). */
export const WAVEFORM_BARS = 64;

/**
 * Forme d'onde à partir des échantillons décodés : on découpe le morceau en
 * `bars` tranches et on garde, pour chacune, le plus fort niveau sonore. Les
 * valeurs sont ramenées entre 4 et 100 (la plus forte vaut 100) pour qu'un
 * morceau calme reste lisible et qu'aucune barre ne disparaisse.
 */
export function computePeaks(channels: Float32Array[], bars = WAVEFORM_BARS): number[] {
  const length = channels[0]?.length ?? 0;
  if (!length) return [];
  const size = Math.max(1, Math.floor(length / bars));
  const peaks: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * size;
    const end = Math.min(length, start + size);
    let peak = 0;
    // Un échantillon sur 16 suffit pour un aperçu (beaucoup plus rapide sur un long morceau).
    for (let i = start; i < end; i += 16) {
      for (const channel of channels) peak = Math.max(peak, Math.abs(channel[i]));
    }
    peaks.push(peak);
  }
  const max = Math.max(...peaks) || 1;
  return peaks.map((peak) => Math.max(4, Math.round((peak / max) * 100)));
}

/**
 * Décode un fichier audio dans le navigateur et calcule sa forme d'onde et sa durée.
 * Renvoie null si le navigateur ne sait pas lire ce fichier.
 */
export async function computeWaveform(file: Blob, bars = WAVEFORM_BARS): Promise<{ peaks: number[]; duration: number } | null> {
  try {
    const context = new OfflineAudioContext(1, 1, 44100);
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    return { peaks: computePeaks(channels, bars), duration: Math.round(buffer.duration * 10) / 10 };
  } catch {
    return null;
  }
}
