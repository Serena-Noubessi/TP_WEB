/**
 * Sauvegarde complète de la base MongoDB, collection par collection, au format
 * Extended JSON (les identifiants, dates et types MongoDB sont conservés).
 *
 *   npm run backup                 → backend/backups/<date>/<collection>.json
 *
 * Les fichiers audio ne sont pas copiés : ils restent dans data/uploads et ne
 * sont jamais supprimés par les migrations.
 */
import mongoose from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("[backup] MONGODB_URI manquant (lancer avec : npm run backup)");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const folder = path.resolve("backups", stamp);
mkdirSync(folder, { recursive: true });

await mongoose.connect(uri);
const db = mongoose.connection.db;
const { EJSON } = mongoose.mongo.BSON;
let total = 0;
for (const { name } of await db.listCollections().toArray()) {
  const documents = await db.collection(name).find({}).toArray();
  writeFileSync(path.join(folder, `${name}.json`), EJSON.stringify(documents, { relaxed: false }, 2));
  console.log(`[backup] ${name} : ${documents.length} document(s)`);
  total += documents.length;
}
writeFileSync(path.join(folder, "_info.json"), JSON.stringify({ date: new Date().toISOString(), database: db.databaseName, total }, null, 2));
await mongoose.disconnect();
console.log(`[backup] Terminé : ${total} document(s) dans ${folder}`);
