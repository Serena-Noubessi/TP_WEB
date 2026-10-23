/**
 * Restaure une sauvegarde faite par backup-db.mjs.
 * ATTENTION : remplace le contenu des collections sauvegardées.
 *
 *   npm run restore -- backups/<date> --oui
 */
import mongoose from "mongoose";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const [folderArg, confirm] = process.argv.slice(2);
if (!folderArg || confirm !== "--oui") {
  console.error("Usage : npm run restore -- backups/<date> --oui   (remplace les collections sauvegardées)");
  process.exit(1);
}
const folder = path.resolve(folderArg);
const { EJSON } = mongoose.mongo.BSON;

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
for (const file of readdirSync(folder).filter((name) => name.endsWith(".json") && !name.startsWith("_"))) {
  const name = file.replace(/\.json$/, "");
  const documents = EJSON.parse(readFileSync(path.join(folder, file), "utf8"), { relaxed: false });
  await db.collection(name).deleteMany({});
  if (documents.length) await db.collection(name).insertMany(documents);
  console.log(`[restore] ${name} : ${documents.length} document(s) restauré(s)`);
}
await mongoose.disconnect();
