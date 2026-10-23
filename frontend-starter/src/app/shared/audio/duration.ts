/**
 * Mesure la durée d'un fichier audio (en secondes) avec un élément <audio> qui
 * ne lit que les métadonnées. Renvoie null si le navigateur ne sait pas la lire
 * (format inconnu, fichier abîmé) ou si la mesure dépasse `timeoutMs`.
 */
export function measureDuration(file: Blob, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    audio.preload = 'metadata';
    audio.muted = true;
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 10) / 10 : null);
    audio.onerror = () => finish(null);
    audio.src = url;
  });
}

/** « 3:07 », ou « 1:02:05 » au-delà d'une heure. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
