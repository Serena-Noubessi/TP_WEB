import mongoose from "mongoose";

/**
 * Demande d'autorisation de remix (section 8) : requesterId demande à ownerId
 * le droit de publier un mixage contenant sa piste trackId.
 * Une seule demande par piste et par demandeur ; un refus peut être suivi
 * d'une nouvelle demande (elle repasse alors « en attente »).
 */
const schema = new mongoose.Schema(
  {
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "refused"], default: "pending" },
    message: { type: String, trim: true, maxlength: 300, default: "" },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ trackId: 1, requesterId: 1 }, { unique: true });
schema.index({ ownerId: 1, status: 1, createdAt: -1 });
schema.index({ requesterId: 1, createdAt: -1 });

export const RemixRequest = mongoose.model("RemixRequest", schema);
