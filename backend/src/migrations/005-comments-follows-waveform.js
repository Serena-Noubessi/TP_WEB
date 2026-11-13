/**
 * Migration 005 — après la mission (02/11/2026) : commentaires, abonnements,
 * partage de playlists et forme d'onde.
 *
 * - collections et index : comments, follows ;
 * - playlists : champ `sharedWith` (amis choisis) ajouté vide là où il manque ;
 * - pistes : le champ `waveform` est facultatif, rien à modifier.
 *
 * Réversible sans perte :
 * - les collections non vides sont RENOMMÉES (préfixe « rollback005_ ») ;
 * - les playlists partagées avec des amis choisis sont copiées dans
 *   « rollback005_playlistshares », puis repassent en « Privée » (l'ancienne
 *   version ne connaissait que Privée et Publique).
 */
// Noms d'index par défaut de MongoDB, identiques à ceux que crée Mongoose.
const COLLECTIONS = {
  comments: [{ key: { trackId: 1, createdAt: -1 } }, { key: { authorId: 1 } }],
  follows: [{ key: { followerId: 1, followedId: 1 }, unique: true }, { key: { followedId: 1 } }],
};

async function exists(db, name) {
  return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

export default {
  id: "005-comments-follows-waveform",
  description: "Commentaires, abonnements, partage de playlists avec des amis choisis",

  async up(db) {
    const created = [];
    for (const [name, indexes] of Object.entries(COLLECTIONS)) {
      if (!(await exists(db, name))) {
        await db.createCollection(name);
        created.push(name);
      }
      await db.collection(name).createIndexes(indexes);
    }
    const playlists = await db.collection("playlists").updateMany({ sharedWith: { $exists: false } }, { $set: { sharedWith: [] } });
    return { created, playlists: playlists.modifiedCount };
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
        const target = `rollback005_${name}_${Date.now()}`;
        await db.collection(name).rename(target);
        kept.push({ name, renamedTo: target, documents: count });
      }
    }
    const shared = await db.collection("playlists").find({ $or: [{ visibility: "friends" }, { "sharedWith.0": { $exists: true } }] }, { projection: { visibility: 1, sharedWith: 1 } }).toArray();
    if (shared.length) {
      await db.collection("rollback005_playlistshares").insertMany(shared.map(({ _id, ...fields }) => ({ playlistId: _id, ...fields, savedAt: new Date() })));
    }
    await db.collection("playlists").updateMany({ visibility: "friends" }, { $set: { visibility: "private" } });
    await db.collection("playlists").updateMany({}, { $unset: { sharedWith: "" } });
    return { dropped, kept, playlistsSauvegardees: shared.length };
  },
};
