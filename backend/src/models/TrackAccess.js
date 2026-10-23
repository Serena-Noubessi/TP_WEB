import mongoose from "mongoose";

/**
 * Accès accordé par le propriétaire d'une piste à une personne précise.
 * - via « share » : visibilité « Amis choisis » (section 5) ;
 * - via « message » : piste envoyée dans une conversation (section 7).
 * Un accès retiré garde sa trace (`revokedAt`) : plus aucun nouvel accès n'est
 * possible, mais un fichier déjà téléchargé ne peut pas être récupéré à distance.
 */
const schema = new mongoose.Schema(
  {
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    via: { type: String, enum: ["share", "message"], default: "share" },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ trackId: 1, userId: 1 }, { unique: true });
schema.index({ userId: 1, revokedAt: 1 });

export const TrackAccess = mongoose.model("TrackAccess", schema);
