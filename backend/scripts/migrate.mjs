/**
 * Applique ou annule les migrations de la base.
 *
 *   npm run migrate            → applique les migrations en attente
 *   npm run migrate -- status  → liste les migrations appliquées / en attente
 *   npm run migrate -- down    → annule la dernière migration appliquée
 *
 * Faire une sauvegarde avant : npm run backup
 */
import mongoose from "mongoose";
import { migrations } from "../src/migrations/index.js";
import { appliedIds, migrateDown, migrateUp } from "../src/migrations/runner.js";

const command = process.argv[2] ?? "up";
await mongoose.connect(process.env.MONGODB_URI, process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {});
const db = mongoose.connection.db;
try {
  if (command === "status") {
    const done = new Set(await appliedIds(db));
    for (const migration of migrations) console.log(`${done.has(migration.id) ? "✓ appliquée " : "· en attente"}  ${migration.id}`);
  } else if (command === "down") {
    await migrateDown(db, 1);
  } else {
    await migrateUp(db);
  }
} catch (error) {
  console.error("[migrate] Échec", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
