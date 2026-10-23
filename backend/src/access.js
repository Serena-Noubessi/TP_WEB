/**
 * Règles d'accès aux pistes, appliquées par le serveur à CHAQUE requête,
 * y compris sur les liens directs vers les fichiers (audio, pochette).
 *
 * Une piste est lisible par :
 * - son propriétaire ;
 * - tout le monde si elle est publique ;
 * - les personnes qui ont un accès ACTIF (non retiré) dans TrackAccess :
 *   « Amis choisis » (via share) ou piste envoyée dans un message (via message,
 *   valable même pour une piste privée). Repasser une piste en « Privé » retire
 *   les accès « share » (voir routes/library.js).
 */
import mongoose from "mongoose";
import { TrackAccess } from "./models/TrackAccess.js";

/**
 * Règle synchrone, sans les accès individuels. Résultat : « ok », « login »
 * (connexion requise, HTTP 401) ou « forbidden » (HTTP 403).
 */
export function readAccess(track, userId) {
  if (userId && String(track.ownerId) === String(userId)) return "ok";
  if (track.visibility === "public") return "ok";
  return userId ? "forbidden" : "login";
}

/** Règle complète : comme readAccess, plus les accès individuels actifs. */
export async function canRead(track, userId) {
  const access = readAccess(track, userId);
  if (access !== "forbidden") return access;
  const grant = await TrackAccess.exists({ trackId: track._id, userId, revokedAt: null });
  return grant ? "ok" : "forbidden";
}

/** Condition MongoDB : uniquement les pistes visibles par tous (recherche, accueil). */
export const PUBLIC_MATCH = { visibility: "public" };

/**
 * Condition MongoDB : pistes lisibles par un utilisateur connecté (les siennes,
 * les publiques et celles qui lui ont été partagées et sont encore actives).
 */
export async function readableMatch(userId) {
  const grants = await TrackAccess.find({ userId, revokedAt: null }).select("trackId").lean();
  return {
    $or: [
      { ownerId: new mongoose.Types.ObjectId(String(userId)) },
      PUBLIC_MATCH,
      { _id: { $in: grants.map((grant) => grant.trackId) } },
    ],
  };
}

/** Échappe le texte d'une recherche pour qu'il soit traité littéralement dans une regex. */
export function literalRegex(text) {
  return new RegExp(String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}
