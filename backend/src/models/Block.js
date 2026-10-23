import mongoose from "mongoose";

/**
 * Blocage (section 6) : blockerId ne veut plus d'échanges avec blockedId.
 * Tant qu'il existe, aucun des deux ne peut inviter l'autre, lui écrire ou le
 * trouver dans la recherche, et l'amitié éventuelle est supprimée.
 */
const schema = new mongoose.Schema(
  {
    blockerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    blockedId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

schema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
schema.index({ blockedId: 1 });

export const Block = mongoose.model("Block", schema);
