/**
 * Contrat commun des catalogues de musique libre de droits.
 * Pour ajouter un catalogue plus tard, il suffit d'écrire une classe qui
 * respecte cette interface et de l'ajouter à la liste de CatalogService.
 */
export interface MusicCatalog {
  /** Identifiant stable, enregistré avec chaque morceau (« jamendo »). */
  readonly id: string;
  /** Nom affiché à l'utilisateur. */
  readonly label: string;
  /** Mention à afficher près des résultats (crédit exigé par le catalogue). */
  readonly credit: string;
  readonly creditUrl: string;
  /** Vrai si le catalogue a besoin d'une clé qui n'est pas encore renseignée. */
  needsKey(): boolean;
  search(query: string, page: number, signal: AbortSignal): Promise<CatalogPage>;
}

export interface CatalogPage {
  results: CatalogTrack[];
  page: number;
  hasMore: boolean;
}

/** Morceau trouvé dans un catalogue, prêt à être ajouté à la liste. */
export interface CatalogTrack {
  catalogId: string;
  externalId: string;
  title: string;
  artist: string;
  audioUrl: string;
  pageUrl: string | null;
  license: string;
  licenseUrl: string | null;
  imageUrl: string | null;
  durationSeconds: number | null;
}

/** Erreur de catalogue avec un message déjà compréhensible pour l'utilisateur. */
export class CatalogError extends Error {}

/** Transforme une URL Creative Commons en nom court : « CC BY-NC-SA 3.0 ». */
export function licenseLabel(url: string | null | undefined): string {
  if (!url) return 'Licence non précisée';
  const match = /creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/(\d\.\d)?/i.exec(url);
  if (!match) return 'Licence libre (voir le lien)';
  if (match[1] === 'publicdomain') return match[2] === 'zero' ? 'CC0 (domaine public)' : 'Domaine public';
  return `CC ${match[2].toUpperCase()}${match[3] ? ` ${match[3]}` : ''}`;
}
