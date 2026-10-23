/**
 * Migrations de la base, réversibles : chaque migration a une fonction `up`
 * (appliquer) et `down` (annuler). Les migrations appliquées sont notées dans la
 * collection `migrations`, pour ne jamais en rejouer une deux fois.
 */
import { migrations } from "./index.js";

const COLLECTION = "migrations";

export async function appliedIds(db) {
  const rows = await db.collection(COLLECTION).find({}).sort({ appliedAt: 1 }).toArray();
  return rows.map((row) => row._id);
}

/** Applique toutes les migrations pas encore appliquées, dans l'ordre. */
export async function migrateUp(db, log = console.log) {
  const done = new Set(await appliedIds(db));
  let count = 0;
  for (const migration of migrations) {
    if (done.has(migration.id)) continue;
    log(`[migrate] ↑ ${migration.id} — ${migration.description}`);
    const summary = await migration.up(db);
    await db.collection(COLLECTION).insertOne({ _id: migration.id, appliedAt: new Date(), summary });
    log(`[migrate]   ${JSON.stringify(summary)}`);
    count++;
  }
  log(count ? `[migrate] ${count} migration(s) appliquée(s)` : "[migrate] Base déjà à jour");
  return count;
}

/** Annule la dernière migration appliquée (ou les `steps` dernières). */
export async function migrateDown(db, steps = 1, log = console.log) {
  const done = await appliedIds(db);
  for (const id of done.slice(-steps).reverse()) {
    const migration = migrations.find((item) => item.id === id);
    if (!migration) throw new Error(`Migration inconnue : ${id}`);
    log(`[migrate] ↓ ${id}`);
    const summary = await migration.down(db);
    await db.collection(COLLECTION).deleteOne({ _id: id });
    log(`[migrate]   ${JSON.stringify(summary)}`);
  }
}
