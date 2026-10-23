/**
 * Migration 003 — MOST VIBE, sections 6 et 7.
 *
 * Crée les collections et index des nouvelles données :
 * - friendships   : invitations et amitiés (un lien par paire de comptes) ;
 * - blocks        : blocages ;
 * - conversations : une conversation par paire d'amis ;
 * - messages      : messages texte et cartes musicales ;
 * - notifications : notifications (invitations, messages, partages).
 * Aucune donnée existante n'est modifiée (la durée d'une piste, nouveau champ
 * facultatif, vaut null tant qu'elle n'a pas été mesurée).
 *
 * Réversible sans perte : `down` supprime les collections vides et RENOMME celles
 * qui contiennent des données (préfixe « rollback003_ ») au lieu de les effacer.
 */
// Noms d'index par défaut de MongoDB, identiques à ceux que crée Mongoose.
const COLLECTIONS = {
  friendships: [
    { key: { pairKey: 1 }, unique: true },
    { key: { requesterId: 1, status: 1 } },
    { key: { recipientId: 1, status: 1 } },
  ],
  blocks: [
    { key: { blockerId: 1, blockedId: 1 }, unique: true },
    { key: { blockedId: 1 } },
  ],
  conversations: [
    { key: { pairKey: 1 }, unique: true },
    { key: { participants: 1, lastMessageAt: -1 } },
  ],
  messages: [{ key: { conversationId: 1, createdAt: -1 } }],
  notifications: [{ key: { userId: 1, readAt: 1, updatedAt: -1 } }],
};

async function exists(db, name) {
  return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

export default {
  id: "003-friends-messages",
  description: "Collections et index des amis, blocages, conversations, messages et notifications",

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
        const target = `rollback003_${name}_${Date.now()}`;
        await db.collection(name).rename(target);
        kept.push({ name, renamedTo: target, documents: count });
      }
    }
    return { dropped, kept };
  },
};
