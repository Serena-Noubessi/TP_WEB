/**
 * Migration 002 — MOST VIBE, sections 4 et 5.
 *
 * Crée les collections et index des nouvelles données :
 * - reactions       : j'aime et favoris (une réaction par utilisateur, piste et type) ;
 * - trackaccesses   : accès individuels « Amis choisis » et partages par message ;
 * - playlists       : playlists personnelles ;
 * - externaltracks  : morceaux en ligne (références), jusqu'ici gardés dans le navigateur.
 * Aucune donnée existante n'est modifiée.
 *
 * Réversible sans perte : `down` supprime les collections vides et RENOMME celles
 * qui contiennent des données (préfixe « rollback002_ ») au lieu de les effacer.
 */
// Noms d'index par défaut de MongoDB, identiques à ceux que crée Mongoose.
const COLLECTIONS = {
  reactions: [
    { key: { userId: 1, trackId: 1, type: 1 }, unique: true },
    { key: { userId: 1, type: 1, createdAt: -1 } },
    { key: { trackId: 1 } },
  ],
  trackaccesses: [
    { key: { trackId: 1, userId: 1 }, unique: true },
    { key: { userId: 1, revokedAt: 1 } },
  ],
  playlists: [{ key: { ownerId: 1 } }],
  externaltracks: [
    { key: { ownerId: 1, audioUrl: 1 }, unique: true },
    { key: { ownerId: 1 } },
  ],
};

async function exists(db, name) {
  return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

export default {
  id: "002-library-access",
  description: "Collections et index des réactions, accès individuels, playlists et morceaux en ligne",

  async up(db) {
    const created = [];
    for (const [name, indexes] of Object.entries(COLLECTIONS)) {
      if (!(await exists(db, name))) {
        await db.createCollection(name);
        created.push(name);
      }
      await db.collection(name).createIndexes(indexes);
    }
    return { created, indexed: Object.keys(COLLECTIONS) };
  },

  async down(db) {
    const dropped = [];
    const kept = [];
    for (const name of Object.keys(COLLECTIONS)) {
      if (!(await exists(db, name))) continue;
      const count = await db.collection(name).countDocuments();
      if (count === 0) {
        await db.collection(name).drop();
        dropped.push(name);
      } else {
        const target = `rollback002_${name}_${Date.now()}`;
        await db.collection(name).rename(target);
        kept.push({ name, renamedTo: target, documents: count });
      }
    }
    return { dropped, kept };
  },
};
