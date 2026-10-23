import mongoose from "mongoose";

export const REPORT_REASONS = ["spam", "inappropriate", "copyright", "harassment", "other"];

/**
 * Signalement d'une piste ou d'un profil (sections 10 et 11), traité par un
 * administrateur. Les conversations privées ne peuvent pas être signalées
 * (l'administration n'y a jamais accès).
 */
const schema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["track", "user"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    /** Propriétaire de la piste signalée, ou le profil signalé lui-même. */
    targetOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["open", "resolved", "dismissed"], default: "open" },
    action: { type: String, enum: ["none", "unpublished", "deleted", "suspended"], default: "none" },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ status: 1, createdAt: -1 });
schema.index({ targetType: 1, targetId: 1, status: 1 });
schema.index({ reporterId: 1, targetType: 1, targetId: 1, status: 1 });

export const Report = mongoose.model("Report", schema);
