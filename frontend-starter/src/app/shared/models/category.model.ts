import { IconName } from '../icons/icons';
import { Track } from './track.model';

/** Style musical d'un morceau (MOST VIBE). */
export interface MusicCategory {
  /** Identifiant enregistré en base (champ `style` des pistes). */
  id: string;
  label: string;
  /** Icône Lucide (voir shared/icons/icons.ts). */
  icon: IconName;
  /** Couleur associée (pastilles, bordures), choisie pour s'accorder avec la charte. */
  color: string;
  /** Mots reconnus dans un nom de dossier ou un genre ID3 pour classer automatiquement. */
  aliases: string[];
}

/**
 * Les 8 styles de MOST VIBE (identiques à STYLES dans backend/src/constants.js).
 * Regroupement décidé le 14/10/2026 : house, techno, dubstep… → électro.
 * Dance ajouté ensuite : dance, dance house, edm, disco… ne vont plus dans électro.
 */
export const CATEGORIES: MusicCategory[] = [
  { id: 'hip-hop', label: 'Hip-hop', icon: 'headphones', color: '#ff7a59', aliases: ['hip-hop', 'hip hop', 'hiphop', 'rap', 'trap', 'boom bap'] },
  { id: 'afro', label: 'Afro', icon: 'drum', color: '#f5a524', aliases: ['afro', 'afro house', 'afrobeat', 'afrobeats', 'amapiano', 'coupé-décalé', 'makossa'] },
  {
    id: 'electro',
    label: 'Électro',
    icon: 'zap',
    color: '#007fff',
    aliases: ['electro', 'électro', 'electronic', 'electronica', 'house', 'deep house', 'techno', 'dubstep', 'trance', 'drum & bass', 'drum and bass', 'synthwave'],
  },
  { id: 'pop', label: 'Pop', icon: 'mic', color: '#e05ad8', aliases: ['pop'] },
  { id: 'jazz', label: 'Jazz', icon: 'piano', color: '#a99bef', aliases: ['jazz', 'blues', 'soul'] },
  { id: 'rock', label: 'Rock', icon: 'guitar', color: '#ef4444', aliases: ['rock', 'metal', 'punk'] },
  { id: 'dance', label: 'Dance', icon: 'party', color: '#14b8a6', aliases: ['dance', 'dance house', 'dance-house', 'eurodance', 'edm', 'disco', 'dance pop'] },
  { id: 'autres', label: 'Autres', icon: 'globe', color: '#7d93ad', aliases: ['autres', 'autre', 'other', 'lo-fi', 'lofi', 'reggaeton'] },
];

/** Style par défaut, utilisé aussi quand une valeur est inconnue. */
export const DEFAULT_CATEGORY = CATEGORIES[CATEGORIES.length - 1];

/** Ancien préfixe de titre (« [House] … ») : retiré à l'affichage s'il en reste un. */
const LEGACY_PREFIX = /^\[([^\]]{1,40})\]\s*/;

export function findCategory(id: string | null | undefined): MusicCategory | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** Reconnaît un style dans un texte libre (nom de dossier « 01-house », genre ID3 « Autre / Trance »…). */
export function guessCategory(text: string | null | undefined): MusicCategory | undefined {
  if (!text) return undefined;
  const clean = text.toLowerCase().replace(/^\d+[-_ ]*/, '').replace(/[_]/g, ' ').trim();
  const head = clean.split('/')[0].trim();
  const exact = CATEGORIES.find((category) => category.aliases.includes(head));
  if (exact) return exact;
  // Les mots les plus longs d'abord : « dance house mix » doit donner Électro via « dance house ».
  const aliases = CATEGORIES.flatMap((category) => category.aliases.map((alias) => ({ alias, category }))).sort(
    (a, b) => b.alias.length - a.alias.length,
  );
  return aliases.find(({ alias }) => clean.includes(alias))?.category;
}

/** Style d'une piste : champ `style` (base), ou catégorie d'un morceau en ligne (anciens identifiants convertis). */
export function categoryOf(track: Pick<Track, 'style' | 'online'>): MusicCategory {
  const id = track.style ?? track.online?.category;
  return findCategory(id) ?? guessCategory(id) ?? DEFAULT_CATEGORY;
}

/** Titre affiché (sans un éventuel ancien préfixe de catégorie). */
export function displayTitle(track: Pick<Track, 'title'>): string {
  return track.title.replace(LEGACY_PREFIX, '');
}
