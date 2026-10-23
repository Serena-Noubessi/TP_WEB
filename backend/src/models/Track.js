import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";
import { STYLES, TRACK_KINDS, VISIBILITIES } from "../constants.js";

/*
 * Ce schéma conserve les métadonnées d'une piste. Le fichier audio lui-même
 * reste sur le disque ; storedName contient le nom technique utilisé côté
 * serveur et n'est jamais exposé par toPublic().
 */
const schema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    coverStoredName: { type: String, select: false },
    coverMimeType: { type: String, select: false },
    // MOST VIBE (migration 001) : style, visibilité et informations de découverte.
    style: { type: String, enum: STYLES, default: "autres", index: true },
    visibility: { type: String, enum: VISIBILITIES, default: "private" },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
      validate: { validator: (tags) => tags.length <= 10, message: "10 tags au maximum" },
    },
    album: { type: String, trim: true, maxlength: 80, default: null },
    kind: { type: String, enum: TRACK_KINDS, default: "track" },
    // MOST VIBE étape 3 : durée mesurée par le navigateur (affichée dans le choix d'une piste à envoyer).
    durationSeconds: { type: Number, min: 0, max: 86400, default: null },
    // Section 8 : crédits d'un mixage, calculés et figés par le serveur à la publication.
    // Aucune route ne permet de les modifier ensuite.
    credits: {
      type: {
        _id: false,
        remixBy: { _id: false, id: mongoose.Schema.Types.ObjectId, name: String },
        sources: [{ _id: false, trackId: mongoose.Schema.Types.ObjectId, title: String, ownerId: mongoose.Schema.Types.ObjectId, ownerName: String }],
        external: [{ _id: false, title: String, artist: String, license: String, sourceLabel: String, pageUrl: String }],
      },
      default: null,
    },
    mixProjectId: { type: mongoose.Schema.Types.ObjectId, ref: "MixProject", default: null },
    // Valeurs d'avant la migration 001, gardées pour pouvoir l'annuler.
    legacyTitle: { type: String, select: false },
    legacyCategory: { type: String, select: false },
  },
  { timestamps: true },
);

// Cet index accélère la liste des pistes d'un utilisateur triées par date.
schema.index({ ownerId: 1, createdAt: -1 });
schema.plugin(aggregatePaginate);

/**
 * Convertit un document Mongoose en objet sûr pour le frontend.
 * L'identifiant MongoDB devient la propriété simple `id` attendue par Angular.
 */
/** Crédits au format JSON (identifiants en chaînes), ou null. */
export function publicCredits(credits) {
  if (!credits?.remixBy) return null;
  return {
    remixBy: { id: String(credits.remixBy.id), name: credits.remixBy.name },
    sources: (credits.sources ?? []).map((source) => ({ trackId: String(source.trackId), title: source.title, ownerId: String(source.ownerId), ownerName: source.ownerName })),
    external: (credits.external ?? []).map((item) => ({ title: item.title, artist: item.artist, license: item.license, sourceLabel: item.sourceLabel, pageUrl: item.pageUrl ?? null })),
  };
}

schema.methods.toPublic = function () {
  console.debug(`[track-model] Préparation de la piste publique ${this.id}`);
  return {
    id: this.id,
    ownerId: String(this.ownerId),
    title: this.title,
    originalName: this.originalName,
    mimeType: this.mimeType,
    size: this.size,
    style: this.style,
    visibility: this.visibility,
    tags: this.tags,
    album: this.album,
    kind: this.kind,
    durationSeconds: this.durationSeconds ?? null,
    credits: publicCredits(this.credits),
    coverUrl: this.coverStoredName
      ? `/api/tracks/${this.id}/cover`
      : null,
    createdAt: this.createdAt,
  };
};

export const Track = mongoose.model("Track", schema);
