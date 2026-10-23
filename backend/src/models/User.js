import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_PRIVACY, ROLES, VISIBILITIES } from "../constants.js";

/*
 * Un schéma Mongoose décrit la forme des documents MongoDB et leurs règles de
 * validation. `timestamps` ajoute automatiquement createdAt et updatedAt.
 */
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // select:false empêche de renvoyer le hash par défaut dans les requêtes.
    passwordHash: { type: String, required: true, select: false },
    // MOST VIBE : « admin » donne accès à l'espace d'administration (section 10).
    role: { type: String, enum: ROLES, default: "user" },
    // MOST VIBE étape 4 (section 9) : confidentialité et notifications.
    privacy: {
      allowFriendRequests: { type: Boolean, default: DEFAULT_PRIVACY.allowFriendRequests },
      showInSearch: { type: Boolean, default: DEFAULT_PRIVACY.showInSearch },
      defaultVisibility: { type: String, enum: VISIBILITIES, default: DEFAULT_PRIVACY.defaultVisibility },
    },
    notificationPrefs: {
      friend_request: { type: Boolean, default: true },
      friend_accepted: { type: Boolean, default: true },
      message: { type: Boolean, default: true },
      track_shared: { type: Boolean, default: true },
      remix: { type: Boolean, default: true },
    },
    // Section 10 : compte suspendu par un administrateur (connexion refusée).
    suspendedAt: { type: Date, default: null },
    suspendedReason: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { timestamps: true },
);

/**
 * Virtual property : `password` n'est pas stocké dans MongoDB.
 * Le setter conserve temporairement le mot de passe en mémoire pour que le
 * hook pre('validate') puisse le hacher avant la sauvegarde.
 */
schema.virtual("password").set(function (value) {
  this._plainPassword = value;
});

/**
 * Hook exécuté avant la validation d'un nouvel utilisateur.
 * bcrypt transforme le mot de passe en hash irréversible ; le mot de passe
 * original ne doit jamais être écrit dans la base ni dans les logs.
 */
schema.pre("validate", async function () {
  if (this.isNew && this._plainPassword) {
    console.debug(`[user-model] Hachage du mot de passe pour ${this.email}`);
    this.passwordHash = await bcrypt.hash(this._plainPassword, 10);
  }
});

/** Compare un mot de passe reçu avec le hash stocké. */
schema.methods.verifyPassword = function (value) {
  console.debug(`[user-model] Vérification du mot de passe pour ${this.email}`);
  return bcrypt.compare(value, this.passwordHash);
};

/** Retourne uniquement les champs qu'une réponse HTTP peut exposer. */
schema.methods.toPublic = function () {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    role: this.role ?? "user",
    createdAt: this.createdAt,
  };
};

/** Paramètres du compte (section 9), avec les valeurs par défaut pour un ancien compte. */
schema.methods.settings = function () {
  const privacy = this.privacy?.toObject?.() ?? this.privacy ?? {};
  const prefs = this.notificationPrefs?.toObject?.() ?? this.notificationPrefs ?? {};
  return {
    privacy: { ...DEFAULT_PRIVACY, ...privacy },
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...prefs },
  };
};

export const User = mongoose.model("User", schema);
