import mongoose from "mongoose";

/**
 * Abonnement : followerId suit l'artiste followedId (sans demande d'accord).
 * L'abonné voit les créations PUBLIQUES de l'artiste dans son fil et reçoit une
 * notification à chaque nouvelle publication publique.
 */
const schema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    followedId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

schema.index({ followerId: 1, followedId: 1 }, { unique: true });
schema.index({ followedId: 1 });

export const Follow = mongoose.model("Follow", schema);
