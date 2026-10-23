/**
 * Crée (ou recrée) la base de DÉMONSTRATION « most-vibe-demo » : jamais la vraie base.
 *
 *   npm run demo:seed
 *
 * Comptes (mot de passe : MotDePasse123) :
 * - A : alice@mostvibe.test (Alice Vibe)
 * - B : bob@mostvibe.test   (Bob Beat)
 * - C : chloe@mostvibe.test (Chloé Groove)
 * 9 pistes : 7 publiques, 2 privées (« Démo secrète » d'Alice, « Brouillon de Bob »).
 * Les fichiers audio viennent du dossier musiques-generees/ (générés par outils/generateur-musique).
 *
 * Les migrations sont appliquées sur la base vide AVANT d'ajouter les données,
 * pour qu'elles soient notées comme faites (sinon elles se rejoueraient plus tard
 * sur des données déjà au bon format).
 */
import mongoose from "mongoose";
import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateUp } from "../src/migrations/runner.js";
import { Track } from "../src/models/Track.js";
import { User } from "../src/models/User.js";

const DEMO_DB = "most-vibe-demo";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const UPLOADS = path.join(ROOT, "backend", "data", "uploads");
const PASSWORD = "MotDePasse123";

await mongoose.connect(process.env.MONGODB_URI, { dbName: DEMO_DB });
if (mongoose.connection.db.databaseName !== DEMO_DB) throw new Error(`Sécurité : ce script ne touche que ${DEMO_DB}`);
try {
  await mongoose.connection.db.dropDatabase();
  await migrateUp(mongoose.connection.db, () => undefined);

  // Anciens fichiers de démonstration (créés uniquement par ce script, préfixe « demo- »).
  mkdirSync(UPLOADS, { recursive: true });
  for (const name of readdirSync(UPLOADS).filter((file) => file.startsWith("demo-"))) unlinkSync(path.join(UPLOADS, name));

  const alice = await User.create({ name: "Alice Vibe", email: "alice@mostvibe.test", password: PASSWORD });
  const bob = await User.create({ name: "Bob Beat", email: "bob@mostvibe.test", password: PASSWORD });
  await User.create({ name: "Chloé Groove", email: "chloe@mostvibe.test", password: PASSWORD });

  const pick = (folder, index) => {
    const dir = path.join(ROOT, "musiques-generees", folder);
    return path.join(dir, readdirSync(dir).filter((file) => file.endsWith(".mp3"))[index]);
  };
  const items = [
    [alice, pick("05-hip-hop", 3), { title: "Asphalt Stories", style: "hip-hop", visibility: "public", tags: ["boom bap"] }],
    [alice, pick("08-autre", 5), { title: "Soleil de Douala", style: "afro", visibility: "public", album: "Lumière d’été", tags: ["été", "afro"] }],
    [alice, pick("03-electro", 2), { title: "Neon Avenue", style: "electro", visibility: "public", album: "Lumière d’été" }],
    [alice, pick("04-pop", 1), { title: "Bleu Azur", style: "pop", visibility: "public", tags: ["été"] }],
    [alice, pick("01-house", 4), { title: "Démo secrète", style: "electro", visibility: "private" }],
    [bob, pick("08-autre", 1), { title: "Café Jazz Club", style: "jazz", visibility: "public" }],
    [bob, pick("06-techno", 0), { title: "Garage Riff", style: "rock", visibility: "public" }],
    [bob, pick("02-dance-house", 2), { title: "Sunset Mix vol.1", style: "electro", visibility: "public", kind: "mix" }],
    [bob, pick("07-dubstep", 3), { title: "Brouillon de Bob", style: "electro", visibility: "private" }],
  ];
  for (const [owner, file, fields] of items) {
    const storedName = `demo-${new mongoose.Types.ObjectId()}.mp3`;
    copyFileSync(file, path.join(UPLOADS, storedName));
    await Track.create({ ownerId: owner._id, originalName: path.basename(file), storedName, mimeType: "audio/mpeg", size: 1, ...fields });
  }
  console.log(`[demo] Base ${DEMO_DB} prête : ${await User.countDocuments()} comptes, ${await Track.countDocuments()} pistes`);
} finally {
  await mongoose.disconnect();
}
