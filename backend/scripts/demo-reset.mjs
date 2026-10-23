/**
 * Remet la base de DÉMONSTRATION « most-vibe-demo » dans son état de départ entre
 * deux séries de tests navigateur, sans recopier les fichiers audio :
 * - efface les données sociales et de création (amis, messages, réactions, accès,
 *   playlists, projets de mixage, demandes de remix, signalements, notifications…) ;
 * - supprime les pistes ajoutées pendant les tests (tout ce qui n'est pas « demo- ») ;
 * - remet les 9 pistes de départ dans leur visibilité d'origine ;
 * - supprime les comptes temporaires (temp-…@mostvibe.test) et lève toute suspension.
 *
 *   npm run demo:reset
 */
import mongoose from "mongoose";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_DB = "most-vibe-demo";
const UPLOADS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "uploads");
const PRIVATE_TITLES = ["Démo secrète", "Brouillon de Bob"];

await mongoose.connect(process.env.MONGODB_URI, { dbName: DEMO_DB });
const db = mongoose.connection.db;
if (db.databaseName !== DEMO_DB) throw new Error(`Sécurité : ce script ne touche que ${DEMO_DB}`);
try {
  for (const name of ["friendships", "blocks", "conversations", "messages", "notifications", "trackaccesses", "reactions", "playlists", "externaltracks", "mixprojects", "remixrequests", "reports"]) {
    await db.collection(name).deleteMany({});
  }
  // Pistes créées pendant les tests (envois, mixages publiés) : métadonnées et fichiers.
  const extra = await db.collection("tracks").find({ storedName: { $not: /^demo-/ } }).toArray();
  for (const track of extra) {
    for (const file of [track.storedName, track.coverStoredName].filter(Boolean)) {
      try {
        unlinkSync(path.join(UPLOADS, file));
      } catch {
        /* déjà absent */
      }
    }
  }
  await db.collection("tracks").deleteMany({ _id: { $in: extra.map((track) => track._id) } });
  await db.collection("tracks").updateMany({ storedName: /^demo-/ }, { $set: { visibility: "public" } });
  await db.collection("tracks").updateMany({ title: { $in: PRIVATE_TITLES } }, { $set: { visibility: "private" } });
  const temp = await db.collection("users").deleteMany({ email: /^temp-.*@mostvibe\.test$/ });
  await db.collection("users").updateMany(
    { email: /@mostvibe\.test$/ },
    { $set: { role: "user", suspendedAt: null, suspendedReason: "", "privacy.showInSearch": true, "privacy.allowFriendRequests": true, "privacy.defaultVisibility": "private" } },
  );
  console.log(`[demo] Base ${DEMO_DB} remise à zéro (${extra.length} piste(s) de test et ${temp.deletedCount} compte(s) temporaire(s) supprimés)`);
} finally {
  await mongoose.disconnect();
}
