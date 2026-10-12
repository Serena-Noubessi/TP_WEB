/** Identifiant d'une platine de la table de mixage. */
export type DeckId = 'A' | 'B';

/** Bandes de l'égaliseur trois voies d'une voie du mixeur. */
export type EqBand = 'high' | 'mid' | 'low';

/** Effets disponibles sur chaque platine. */
export type FxType = 'echo' | 'reverb' | 'flanger';

/** Tempo détecté d'un morceau, conservé dans le navigateur par identifiant de piste. */
export interface TrackAnalysis {
  /** Battements par minute à vitesse d'origine. */
  bpm: number;
  /** Position (en secondes) du premier temps de la grille rythmique. */
  firstBeat: number;
}

/** Forme d'onde précalculée d'un morceau pour l'affichage. */
export interface WaveformData {
  /** Nombre de colonnes calculées par seconde de morceau. */
  binsPerSecond: number;
  /** Crête du signal complet (0 à 1) par colonne. */
  peaks: Float32Array;
  /** Crête des basses fréquences (0 à 1) par colonne. */
  lows: Float32Array;
}

/** Boucle active d'une platine, en secondes de morceau. */
export interface LoopRegion {
  start: number;
  end: number;
  beats: number;
}

/** Type MIME utilisé pour glisser une piste de la bibliothèque vers une platine. */
export const TRACK_DRAG_TYPE = 'application/x-gpc-track';
