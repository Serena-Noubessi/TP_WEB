import mongoose from "mongoose";

/**
 * Morceau ajouté depuis internet (lien direct ou catalogue libre comme Jamendo).
 * Seule la RÉFÉRENCE est enregistrée (titre, artiste, source, licence, adresse) :
 * le fichier n'est jamais copié sur le serveur (conditions de Jamendo).
 * Visible uniquement par son propriétaire.
 */
const schema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    artist: { type: String, trim: true, maxlength: 120, default: "Artiste inconnu" },
    audioUrl: { type: String, required: true, maxlength: 2000 },
    sourceId: { type: String, required: true, maxlength: 40 },
    sourceLabel: { type: String, required: true, maxlength: 120 },
    pageUrl: { type: String, maxlength: 2000, default: null },
    license: { type: String, maxlength: 120, default: "Licence non précisée" },
    licenseUrl: { type: String, maxlength: 2000, default: null },
    imageUrl: { type: String, maxlength: 2000, default: null },
    durationSeconds: { type: Number, min: 0, default: null },
    style: { type: String, maxlength: 40, default: "autres" },
    originalName: { type: String, maxlength: 300, default: "" },
    mimeType: { type: String, maxlength: 100, default: "audio/mpeg" },
    size: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

schema.index({ ownerId: 1, audioUrl: 1 }, { unique: true });

schema.methods.toPublic = function () {
  return {
    id: this.id,
    title: this.title,
    originalName: this.originalName,
    mimeType: this.mimeType,
    size: this.size,
    createdAt: this.createdAt,
    style: this.style,
    online: {
      audioUrl: this.audioUrl,
      artist: this.artist,
      sourceId: this.sourceId,
      sourceLabel: this.sourceLabel,
      pageUrl: this.pageUrl,
      license: this.license,
      licenseUrl: this.licenseUrl,
      imageUrl: this.imageUrl,
      durationSeconds: this.durationSeconds,
      category: this.style,
    },
  };
};

export const ExternalTrack = mongoose.model("ExternalTrack", schema);
