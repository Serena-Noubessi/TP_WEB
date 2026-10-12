import { Track } from './track.model';

/** Catégorie musicale d'un morceau. */
export interface MusicCategory {
  id: string;
  label: string;
  icon: string;
  /** Couleur principale (pastilles, bordures). */
  color: string;
  /** Mots reconnus dans un nom de dossier ou une étiquette de genre (ID3) pour classer automatiquement. */
  aliases: string[];
}

export const CATEGORIES: MusicCategory[] = [
  { id: 'house', label: 'House', icon: '🏠', color: '#2ec4a6', aliases: ['house', 'deep house'] },
  { id: 'dance-house', label: 'Dance House', icon: '💃', color: '#ff5fa2', aliases: ['dance house', 'dance-house', 'dance', 'edm'] },
  { id: 'electro', label: 'Electro', icon: '⚡', color: '#f5b700', aliases: ['electro', 'electronic', 'electronica'] },
  { id: 'pop', label: 'Pop', icon: '🎤', color: '#a66cff', aliases: ['pop'] },
  { id: 'hip-hop', label: 'Hip-Hop', icon: '🎧', color: '#ff7a3d', aliases: ['hip-hop', 'hip hop', 'hiphop', 'rap'] },
  { id: 'techno', label: 'Techno', icon: '🤖', color: '#3d8bff', aliases: ['techno'] },
  { id: 'dubstep', label: 'Dubstep', icon: '🔊', color: '#22c55e', aliases: ['dubstep'] },
  { id: 'autre', label: 'Autre', icon: '🌍', color: '#94a3b8', aliases: ['autre', 'other'] },
];

/** Catégorie affichée pour les morceaux importés avant le classement. */
export const UNCLASSIFIED: MusicCategory = { id: 'non-classe', label: 'Non classé', icon: '📁', color: '#b8c4bf', aliases: [] };

/**
 * Le backend ne stocke qu'un titre : la catégorie est donc écrite en tête du titre,
 * entre crochets (« [House] Stellar Rooftop »). Elle est ainsi conservée sur le
 * serveur et la recherche existante du backend (sur le titre) sait filtrer par catégorie.
 */
const PREFIX = /^\[([^\]]{1,40})\]\s*/;

export function findCategory(id: string | null | undefined): MusicCategory | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** Reconnaît une catégorie dans un texte libre (nom de dossier, genre ID3 « Autre / Trance »…). */
export function guessCategory(text: string | null | undefined): MusicCategory | undefined {
  if (!text) return undefined;
  const clean = text.toLowerCase().replace(/^\d+[-_ ]*/, '').replace(/[_]/g, ' ').trim();
  const head = clean.split('/')[0].trim();
  const exact = CATEGORIES.find((category) => category.aliases.includes(head));
  if (exact) return exact;
  // Les alias les plus longs d'abord : « dance house mix » doit donner Dance House, pas House.
  const aliases = CATEGORIES.flatMap((category) => category.aliases.map((alias) => ({ alias, category })))
    .sort((a, b) => b.alias.length - a.alias.length);
  return aliases.find(({ alias }) => clean.includes(alias))?.category;
}

export function categoryOf(track: Track): MusicCategory {
  if (track.online) return findCategory(track.online.category) ?? UNCLASSIFIED;
  const match = PREFIX.exec(track.title);
  return (match && CATEGORIES.find((category) => category.label.toLowerCase() === match[1].toLowerCase())) || UNCLASSIFIED;
}

/** Titre sans le préfixe de catégorie, pour l'affichage. */
export function displayTitle(track: Pick<Track, 'title'>): string {
  return track.title.replace(PREFIX, '');
}

/** Titre à envoyer au backend pour une catégorie donnée. */
export function titleWithCategory(title: string, category: MusicCategory | undefined): string {
  const clean = title.replace(PREFIX, '').trim();
  return category ? `[${category.label}] ${clean}` : clean;
}

/** Texte de recherche envoyé au backend pour ne garder qu'une catégorie. */
export function categorySearch(category: MusicCategory): string {
  return `[${category.label}]`;
}
