import { TrackAnalysis } from '../models/dj.model';

/** Points de repère d'un morceau, conservés dans le navigateur. */
export interface StoredCues {
  cue: number;
  hotCues: (number | null)[];
}

const ANALYSIS_PREFIX = 'gpc_dj_analysis_';
const CUES_PREFIX = 'gpc_dj_cues_';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.warn(`[DjStorage] Lecture impossible : ${key}`, error);
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[DjStorage] Écriture impossible : ${key}`, error);
  }
}

export function readAnalysis(trackId: string): TrackAnalysis | null {
  const value = read<TrackAnalysis>(ANALYSIS_PREFIX + trackId);
  return value && Number.isFinite(value.bpm) && Number.isFinite(value.firstBeat) ? value : null;
}

export function writeAnalysis(trackId: string, analysis: TrackAnalysis): void {
  write(ANALYSIS_PREFIX + trackId, analysis);
}

export function readCues(trackId: string): StoredCues | null {
  const value = read<StoredCues>(CUES_PREFIX + trackId);
  return value && Array.isArray(value.hotCues) ? value : null;
}

export function writeCues(trackId: string, cues: StoredCues): void {
  write(CUES_PREFIX + trackId, cues);
}
