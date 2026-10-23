import mongoose from "mongoose";

/**
 * Message d'une conversation : du texte, une piste (carte musicale), ou les deux.
 * La piste n'est qu'une référence : ses droits sont revérifiés à chaque lecture,
 * et la carte affiche « Partage interrompu » si l'accès a été retiré.
 */
const schema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", default: null },
  },
  { timestamps: true },
);

schema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model("Message", schema);
