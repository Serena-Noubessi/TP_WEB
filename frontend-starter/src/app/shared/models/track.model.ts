/** Audio track metadata returned by the API. */
export interface Track {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  coverUrl?: string | null;
  createdAt: string;
  /**
   * Présent uniquement pour un morceau ajouté depuis internet. Ce morceau n'est
   * pas stocké par l'API : seule cette référence est gardée dans le navigateur,
   * et le fichier est téléchargé au moment de l'écouter ou de le mixer.
   */
  online?: OnlineSource;
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
