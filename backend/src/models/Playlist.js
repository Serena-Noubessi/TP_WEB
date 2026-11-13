import mongoose from "mongoose";

/**
 * Playlist personnelle. Elle ne fait que référencer des pistes : chaque piste
 * reste soumise à ses propres droits d'accès (une piste privée d'un autre
 * utilisateur n'est jamais révélée par une playlist).
 */
const schema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    // Privée, Amis choisis (personnes de sharedWith, parmi ses amis) ou Publique.
    visibility: { type: String, enum: ["private", "friends", "public"], default: "private" },
    sharedWith: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    trackIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Track" }],
      default: [],
      validate: { validator: (ids) => ids.length <= 500, message: "500 pistes au maximum par playlist" },
    },
  },
  { timestamps: true },
);

schema.methods.toPublic = function () {
  return {
    id: this.id,
    ownerId: String(this.ownerId),
    name: this.name,
    description: this.description,
    visibility: this.visibility,
    trackCount: this.trackIds.length,
    sharedCount: this.sharedWith?.length ?? 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Playlist = mongoose.model("Playlist", schema);
