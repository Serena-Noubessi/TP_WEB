/** Audio track metadata returned by the API. */
export interface Track {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  coverUrl?: string | null;
  createdAt: string;
  /** MOST VIBE : style musical (hip-hop, afro, electro, pop, jazz, rock, autres). */
  style?: string;
  /** private (propriétaire seulement), friends (personnes choisies) ou public. */
  visibility?: TrackVisibility;
  tags?: string[];
  album?: string | null;
  /** track (piste) ou mix (mixage). */
  kind?: 'track' | 'mix';
  /** Auteur (pistes publiques : nom uniquement, jamais l'email). */
  author?: { id: string; name: string };
  ownerId?: string;
  /** Nombre de « j'aime » (pistes renvoyées par les routes publiques et la bibliothèque). */
  likeCount?: number;
  /** Durée en secondes, mesurée par le navigateur (null tant qu'elle est inconnue). */
  durationSeconds?: number | null;
  /** Crédits d'un mixage publié, figés par le serveur (section 8). */
  credits?: TrackCredits | null;
  /**
   * Présent uniquement pour un morceau ajouté depuis internet. Le fichier n'est
   * pas stocké par l'API : seule cette référence est enregistrée en base
   * (/api/external-tracks), et le fichier est téléchargé au moment de l'écouter ou de le mixer.
   */
  online?: OnlineSource;
}

export type TrackVisibility = 'private' | 'friends' | 'public';

/** « Remix par… » et « À partir de la création de… » (impossibles à modifier). */
export interface TrackCredits {
  remixBy: { id: string; name: string };
  sources: { trackId: string; title: string; ownerId: string; ownerName: string }[];
  external: { title: string; artist: string; license: string; sourceLabel: string; pageUrl: string | null }[];
}

/** Champs MOST VIBE envoyés avec un fichier ou lors d'une modification. */
export interface TrackMeta {
  title?: string;
  style?: string;
  visibility?: TrackVisibility;
  tags?: string;
  album?: string;
  durationSeconds?: number;
}

/** Origine et droits d'un morceau ajouté depuis internet. */
export interface OnlineSource {
  /** Adresse du fichier audio téléchargé par le moteur. */
  audioUrl: string;
  artist: string;
  /** Identifiant de la source : « url » pour un lien direct, sinon l'id du catalogue (« jamendo »…). */
  sourceId: string;
  /** Nom affiché de la source : nom du site ou du catalogue. */
  sourceLabel: string;
  /** Page du morceau chez la source (lien de retour exigé par Jamendo). */
  pageUrl: string | null;
  license: string;
  licenseUrl: string | null;
  /** Pochette hébergée par la source (affichée directement, sans téléchargement). */
  imageUrl: string | null;
  durationSeconds: number | null;
  /** Identifiant de catégorie (voir category.model.ts). */
  category?: string;
}
