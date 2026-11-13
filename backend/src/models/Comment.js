import mongoose from "mongoose";

/**
 * Commentaire (avis) sur une piste. Peut commenter quiconque a le droit
 * d'écouter la piste : tout membre si elle est publique, sinon seulement les
 * personnes qui y ont accès. Les droits sont revérifiés à chaque lecture.
 */
const schema = new mongoose.Schema(
  {
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
  },
  { timestamps: true },
);

schema.index({ trackId: 1, createdAt: -1 });
schema.index({ authorId: 1 });

export const Comment = mongoose.model("Comment", schema);
