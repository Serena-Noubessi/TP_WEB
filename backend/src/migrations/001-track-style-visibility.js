/**
 * Migration 001 — MOST VIBE, sections 1 à 3.
 *
 * Pistes :
 * - la catégorie écrite en tête du titre par le frontend (« [House] Stellar Rooftop »)
 *   devient un vrai champ `style`, regroupé selon la décision du 14/10/2026 :
 *   House, Dance House, Techno, Dubstep → electro ; Hip-Hop → hip-hop ; Pop → pop ;
 *   Electro → electro ; Autre → autres ; sans catégorie → autres ;
 * - `visibility` = « private » (choix par défaut de MOST VIBE : rien ne devient public) ;
 * - `tags` = [], `album` = null, `kind` = « track ».
 * Utilisateurs : `role` = « user ».
 *
 * Réversible : le titre d'origine est gardé dans `legacyTitle` et l'ancienne
 * catégorie dans `legacyCategory` ; `down` restaure exactement l'état précédent.
 */
const PREFIX = /^\[([^\]]{1,40})\]\s*/;
const STYLE_MAP = {
  house: "electro",
  "dance house": "electro",
  techno: "electro",
  dubstep: "electro",
  electro: "electro",
  "hip-hop": "hip-hop",
  pop: "pop",
  autre: "autres",
};

export default {
  id: "001-track-style-visibility",
  description: "Style, visibilité, tags, album et type des pistes ; rôle des utilisateurs",

  async up(db) {
    const tracks = db.collection("tracks");
    let converted = 0;
    let untouched = 0;
    for await (const track of tracks.find({ legacyTitle: { $exists: false } })) {
      const match = PREFIX.exec(track.title ?? "");
      const legacyCategory = match ? match[1] : null;
      // Un style déjà présent (base créée après MOST VIBE, ex. démo) n'est jamais écrasé.
      const style = track.style ?? ((legacyCategory && STYLE_MAP[legacyCategory.toLowerCase()]) || "autres");
      const cleanTitle = match ? track.title.replace(PREFIX, "").trim() || track.title : track.title;
      await tracks.updateOne(
        { _id: track._id },
        {
          $set: {
            legacyTitle: track.title,
            legacyCategory,
            title: cleanTitle,
            style,
            visibility: track.visibility ?? "private",
            tags: track.tags ?? [],
            album: track.album ?? null,
            kind: track.kind ?? "track",
          },
        },
      );
      if (match) converted++;
      else untouched++;
    }
    const users = await db.collection("users").updateMany({ role: { $exists: false } }, { $set: { role: "user" } });
    await tracks.createIndex({ visibility: 1, style: 1, createdAt: -1 }, { name: "visibility_style_createdAt" });
    return { pistesAvecCategorie: converted, pistesSansCategorie: untouched, utilisateurs: users.modifiedCount };
  },

  async down(db) {
    const tracks = db.collection("tracks");
    let restored = 0;
    for await (const track of tracks.find({ legacyTitle: { $exists: true } })) {
      await tracks.updateOne(
        { _id: track._id },
        {
          $set: { title: track.legacyTitle },
          $unset: { legacyTitle: "", legacyCategory: "", style: "", visibility: "", tags: "", album: "", kind: "" },
        },
      );
      restored++;
    }
    const users = await db.collection("users").updateMany({}, { $unset: { role: "" } });
    await tracks.dropIndex("visibility_style_createdAt").catch((error) => {
      if (error.codeName !== "IndexNotFound") throw error;
    });
    return { pistesRestaurees: restored, utilisateurs: users.modifiedCount };
  },
};
