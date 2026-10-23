/**
 * Migration 004 — MOST VIBE, sections 8, 9 et 10.
 *
 * Collections et index :
 * - mixprojects    : projets de mixage (brouillons, publiés) ;
 * - remixrequests  : demandes d'autorisation de remix ;
 * - reports        : signalements traités par l'administration.
 * Comptes : paramètres par défaut (confidentialité, notifications) et champs de
 * suspension, ajoutés seulement là où ils manquent.
 *
 * Réversible sans perte :
 * - les collections vides sont supprimées, celles qui contiennent des données
 *   sont RENOMMÉES (préfixe « rollback004_ ») ;
 * - les paramètres des comptes sont copiés dans « rollback004_usersettings »
 *   avant d'être retirés des comptes.
 */
const DEFAULT_PRIVACY = { allowFriendRequests: true, showInSearch: true, defaultVisibility: "private" };
const DEFAULT_PREFS = { friend_request: true, friend_accepted: true, message: true, track_shared: true, remix: true };
const USER_FIELDS = ["privacy", "notificationPrefs", "suspendedAt", "suspendedReason"];

// Noms d'index par défaut de MongoDB, identiques à ceux que crée Mongoose.
const COLLECTIONS = {
  mixprojects: [{ key: { ownerId: 1 } }, { key: { ownerId: 1, updatedAt: -1 } }],
  remixrequests: [
    { key: { trackId: 1, requesterId: 1 }, unique: true },
    { key: { ownerId: 1, status: 1, createdAt: -1 } },
    { key: { requesterId: 1, createdAt: -1 } },
  ],
  reports: [
    { key: { status: 1, createdAt: -1 } },
    { key: { targetType: 1, targetId: 1, status: 1 } },
    { key: { reporterId: 1, targetType: 1, targetId: 1, status: 1 } },
  ],
};

async function exists(db, name) {
  return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

export default {
  id: "004-mixes-settings-admin",
  description: "Projets de mixage, demandes de remix, signalements ; paramètres et suspension des comptes",

  async up(db) {
    const created = [];
    for (const [name, indexes] of Object.entries(COLLECTIONS)) {
      if (!(await exists(db, name))) {
        await db.createCollection(name);
        created.push(name);
      }
      await db.collection(name).createIndexes(indexes);
    }
    const users = db.collection("users");
    const privacy = await users.updateMany({ privacy: { $exists: false } }, { $set: { privacy: DEFAULT_PRIVACY } });
    const prefs = await users.updateMany({ notificationPrefs: { $exists: false } }, { $set: { notificationPrefs: DEFAULT_PREFS } });
    const suspension = await users.updateMany({ suspendedAt: { $exists: false } }, { $set: { suspendedAt: null, suspendedReason: "" } });
    return { created, comptes: { privacy: privacy.modifiedCount, notificationPrefs: prefs.modifiedCount, suspension: suspension.modifiedCount } };
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
        const target = `rollback004_${name}_${Date.now()}`;
        await db.collection(name).rename(target);
        kept.push({ name, renamedTo: target, documents: count });
      }
    }
    // Copie des paramètres des comptes avant de les retirer (aucune perte).
    const users = db.collection("users");
    const projection = Object.fromEntries(USER_FIELDS.map((field) => [field, 1]));
    const saved = await users.find({ $or: USER_FIELDS.map((field) => ({ [field]: { $exists: true } })) }, { projection }).toArray();
    if (saved.length) {
      await db.collection("rollback004_usersettings").insertMany(saved.map(({ _id, ...fields }) => ({ userId: _id, ...fields, savedAt: new Date() })));
    }
    await users.updateMany({}, { $unset: Object.fromEntries(USER_FIELDS.map((field) => [field, ""])) });
    return { dropped, kept, comptesSauvegardes: saved.length };
  },
};
