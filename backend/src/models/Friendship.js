import mongoose from "mongoose";

/**
 * Lien d'amitié entre deux comptes (section 6).
 * - status « pending » : invitation envoyée par requesterId à recipientId ;
 * - status « accepted » : amis.
 * Une invitation refusée ou annulée, ou une amitié retirée, est supprimée.
 * `pairKey` (les deux identifiants triés) garantit un seul lien par paire.
 */
const schema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ requesterId: 1, status: 1 });
schema.index({ recipientId: 1, status: 1 });

export const pairKey = (a, b) => [String(a), String(b)].sort().join("_");

export const Friendship = mongoose.model("Friendship", schema);
