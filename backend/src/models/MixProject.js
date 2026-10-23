import mongoose from "mongoose";

/**
 * Projet de mixage (section 8) : l'état du studio enregistré en base pour être
 * repris plus tard (brouillon), puis publié sous forme de piste « mix ».
 * `state` est validé et nettoyé par la route avant l'enregistrement.
 */
const schema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    state: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Pistes MOST VIBE et morceaux en ligne utilisés (repris dans les crédits à la publication). */
    sourceTrackIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Track" }], default: [] },
    externalIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ExternalTrack" }], default: [] },
    publishedTrackIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Track" }], default: [] },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

schema.index({ ownerId: 1, updatedAt: -1 });

schema.methods.toPublic = function () {
  return {
    id: this.id,
    title: this.title,
    status: this.status,
    state: this.state,
    sourceTrackIds: this.sourceTrackIds.map(String),
    externalIds: this.externalIds.map(String),
    publishedTrackIds: this.publishedTrackIds.map(String),
    publishedAt: this.publishedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const MixProject = mongoose.model("MixProject", schema);
