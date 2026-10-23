/**
 * Suppression complète d'une piste : métadonnées liées (réactions, accès,
 * entrées de playlist, demandes de remix) puis fichiers sur le disque.
 * Utilisée par la suppression d'une piste, la suppression d'un compte
 * (section 9) et la modération (section 10).
 */
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Playlist } from "./models/Playlist.js";
import { Reaction } from "./models/Reaction.js";
import { RemixRequest } from "./models/RemixRequest.js";
import { TrackAccess } from "./models/TrackAccess.js";

// Même dossier que celui de Multer (app.js) : les fichiers restent sur le disque du serveur.
export const UPLOADS = path.resolve("data/uploads");

/**
 * `track` doit avoir été lu avec `+storedName +coverStoredName`, et le document
 * Track doit déjà être supprimé de la base. Renvoie la liste des fichiers que
 * l'on n'a pas pu effacer (chaque échec est journalisé).
 */
export async function purgeTrack(track) {
  await Promise.all([
    Reaction.deleteMany({ trackId: track._id }),
    TrackAccess.deleteMany({ trackId: track._id }),
    Playlist.updateMany({ trackIds: track._id }, { $pull: { trackIds: track._id } }),
    RemixRequest.deleteMany({ trackId: track._id }),
  ]);
  const failed = [];
  for (const name of [track.storedName, track.coverStoredName].filter(Boolean)) {
    const filePath = path.join(UPLOADS, name);
    try {
      await fsPromises.unlink(filePath);
      console.log(`[tracks] Fichier supprimé : ${filePath}`);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      console.error(`[tracks] Fichier non supprimé : ${filePath}`, error);
      failed.push(filePath);
    }
  }
  return failed;
}
