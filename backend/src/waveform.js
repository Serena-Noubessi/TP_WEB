/**
 * Forme d'onde d'une piste (demande 24) : une suite de valeurs entre 0 et 100,
 * une par « barre » dessinée sur les cartes et dans le lecteur. Elle est calculée
 * par le navigateur (qui sait décoder le son) puis enregistrée avec la piste.
 */
export const WAVEFORM_MIN_BARS = 16;
export const WAVEFORM_MAX_BARS = 200;

/**
 * Lit une forme d'onde envoyée par le navigateur : tableau JSON ou chaîne
 * « 12,40,… » (formulaire multipart). Renvoie { value } ou { error }.
 */
export function parseWaveform(raw) {
  if (raw === undefined || raw === null || raw === "") return { value: undefined };
  const list = Array.isArray(raw) ? raw : String(raw).split(",");
  const values = list.map((item) => Number(item));
  const valid =
    values.length >= WAVEFORM_MIN_BARS &&
    values.length <= WAVEFORM_MAX_BARS &&
    values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  if (!valid) return { error: `Forme d'onde invalide : ${WAVEFORM_MIN_BARS} à ${WAVEFORM_MAX_BARS} valeurs entre 0 et 100` };
  return { value: values.map((value) => Math.round(value)) };
}
