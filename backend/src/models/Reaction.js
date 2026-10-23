import mongoose from "mongoose";

/**
 * Réaction d'un utilisateur à une piste : « like » (j'aime, compté publiquement)
 * ou « favorite » (favori, visible seulement par l'utilisateur). Une seule
 * réaction de chaque type par utilisateur et par piste (index unique).
 */
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: true, index: true },
    type: { type: String, enum: ["like", "favorite"], required: true },
  },
  { timestamps: true },
);

schema.index({ userId: 1, trackId: 1, type: 1 }, { unique: true });
schema.index({ userId: 1, type: 1, createdAt: -1 });

export const Reaction = mongoose.model("Reaction", schema);
