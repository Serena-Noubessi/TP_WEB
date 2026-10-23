import mongoose from "mongoose";

export const NOTIFICATION_TYPES = ["friend_request", "friend_accepted", "message", "track_shared", "remix_request", "remix_accepted", "remix_refused", "content_removed"];

/**
 * Notification destinée à userId, provoquée par actorId.
 * Pour les messages, une seule notification non lue par conversation est tenue
 * à jour (compteur `count`) au lieu d'une par message.
 */
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", default: null },
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", default: null },
    /** Titre gardé pour les notifications sur une piste supprimée (modération). */
    trackTitle: { type: String, default: null },
    count: { type: Number, default: 1, min: 1 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ userId: 1, readAt: 1, updatedAt: -1 });

export const Notification = mongoose.model("Notification", schema);
