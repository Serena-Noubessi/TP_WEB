/**
 * Routes MOST VIBE de la section 9 : paramètres du compte.
 * - confidentialité et préférences de notification ;
 * - changement de mot de passe ;
 * - suppression du compte, avec mot de passe et confirmation écrite.
 */
import bcrypt from "bcryptjs";
import { NOTIFICATION_PREFS, VISIBILITIES } from "../constants.js";
import { Block } from "../models/Block.js";
import { Conversation } from "../models/Conversation.js";
import { ExternalTrack } from "../models/ExternalTrack.js";
import { Friendship } from "../models/Friendship.js";
import { Message } from "../models/Message.js";
import { MixProject } from "../models/MixProject.js";
import { Notification } from "../models/Notification.js";
import { Playlist } from "../models/Playlist.js";
import { Reaction } from "../models/Reaction.js";
import { RemixRequest } from "../models/RemixRequest.js";
import { Report } from "../models/Report.js";
import { Track } from "../models/Track.js";
import { TrackAccess } from "../models/TrackAccess.js";
import { User } from "../models/User.js";
import { revokeSessions } from "../sessions.js";
import { purgeTrack } from "../track-cleanup.js";

/** Mot à taper pour confirmer la suppression du compte. */
export const DELETE_CONFIRMATION = "SUPPRIMER";

/** Conséquences de la suppression, affichées avant la confirmation (et renvoyées par l'API). */
export const DELETE_CONSEQUENCES = [
  "Toutes vos pistes et leurs fichiers audio et pochettes sont définitivement effacés, y compris vos mixages publiés.",
  "Vos playlists, favoris, « j'aime », projets de mixage et morceaux en ligne sont effacés.",
  "Vos amitiés, invitations et blocages sont supprimés ; vos conversations et leurs messages sont effacés pour les deux participants.",
  "Les accès que vous aviez donnés à vos pistes disparaissent avec elles ; un fichier déjà téléchargé par quelqu'un ne peut pas être récupéré à distance.",
  "Les mixages publiés par d'autres avec votre autorisation restent en ligne ; votre nom y est remplacé par « Compte supprimé ».",
  "Cette action est définitive : il n'existe aucun moyen de récupérer le compte ensuite.",
];

export function registerSettingsRoutes(app, { auth }) {
  /** Mes paramètres (confidentialité, notifications) et les conséquences d'une suppression. */
  app.get("/api/users/me/settings", auth, async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.sub);
      if (!user) return res.status(404).json({ message: "Utilisateur inconnu" });
      res.json({ ...user.settings(), deleteConsequences: DELETE_CONSEQUENCES, deleteConfirmation: DELETE_CONFIRMATION });
    } catch (error) {
      console.error("[settings] Erreur de lecture", error);
      next(error);
    }
  });

  /** Modifie une partie des paramètres : { privacy?: {...}, notificationPrefs?: {...} }. */
  app.patch("/api/users/me/settings", auth, async (req, res, next) => {
    try {
      const set = {};
      const errors = [];
      const privacy = req.body?.privacy ?? {};
      for (const key of ["allowFriendRequests", "showInSearch"]) {
        if (privacy[key] === undefined) continue;
        if (typeof privacy[key] !== "boolean") errors.push(`privacy.${key} doit valoir true ou false`);
        else set[`privacy.${key}`] = privacy[key];
      }
      if (privacy.defaultVisibility !== undefined) {
        if (!VISIBILITIES.includes(privacy.defaultVisibility)) errors.push(`Visibilité par défaut inconnue : ${VISIBILITIES.join(", ")}`);
        else set["privacy.defaultVisibility"] = privacy.defaultVisibility;
      }
      const prefs = req.body?.notificationPrefs ?? {};
      for (const [key, value] of Object.entries(prefs)) {
        if (!NOTIFICATION_PREFS.includes(key)) errors.push(`Notification inconnue : ${key}`);
        else if (typeof value !== "boolean") errors.push(`notificationPrefs.${key} doit valoir true ou false`);
        else set[`notificationPrefs.${key}`] = value;
      }
      if (errors.length) return res.status(400).json({ message: errors.join(". ") });
      if (!Object.keys(set).length) return res.status(400).json({ message: "Aucun paramètre à modifier" });
      const user = await User.findByIdAndUpdate(req.auth.sub, { $set: set }, { new: true, runValidators: true });
      if (!user) return res.status(404).json({ message: "Utilisateur inconnu" });
      console.log(`[settings] Paramètres modifiés pour ${user.id} : ${Object.keys(set).join(", ")}`);
      res.json(user.settings());
    } catch (error) {
      console.error("[settings] Erreur de modification", error);
      next(error);
    }
  });

  /** Change le mot de passe : { currentPassword, newPassword (8 caractères minimum) }. */
  app.put("/api/users/me/password", auth, async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body ?? {};
      if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
      const user = await User.findById(req.auth.sub).select("+passwordHash");
      if (!user) return res.status(404).json({ message: "Utilisateur inconnu" });
      if (!(await user.verifyPassword(String(currentPassword ?? "")))) return res.status(403).json({ message: "Mot de passe actuel incorrect" });
      // Le hook du modèle ne hache qu'à la création : on hache explicitement ici.
      user.passwordHash = await bcrypt.hash(newPassword, 10);
      await user.save();
      console.log(`[settings] Mot de passe changé pour ${user.id}`);
      res.status(204).end();
    } catch (error) {
      console.error("[settings] Erreur de changement de mot de passe", error);
      next(error);
    }
  });

  /**
   * Supprime définitivement le compte : { password, confirmation: "SUPPRIMER" }.
   * Toutes les données de l'utilisateur sont effacées (voir DELETE_CONSEQUENCES)
   * et ses jetons de connexion sont refusés immédiatement.
   */
  app.delete("/api/users/me", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const user = await User.findById(me).select("+passwordHash");
      if (!user) return res.status(404).json({ message: "Utilisateur inconnu" });
      if (req.body?.confirmation !== DELETE_CONFIRMATION) return res.status(400).json({ message: `Tapez ${DELETE_CONFIRMATION} pour confirmer` });
      if (!(await user.verifyPassword(String(req.body?.password ?? "")))) return res.status(403).json({ message: "Mot de passe incorrect" });

      // 1. Pistes et fichiers (avec leurs réactions, accès, playlists, demandes de remix).
      const tracks = await Track.find({ ownerId: me }).select("+storedName +coverStoredName");
      const failedFiles = [];
      for (const track of tracks) {
        await track.deleteOne();
        failedFiles.push(...(await purgeTrack(track)));
      }
      // 2. Conversations (et tous leurs messages) dont il est participant.
      const conversations = await Conversation.find({ participants: user._id }).select("_id").lean();
      const conversationIds = conversations.map((conversation) => conversation._id);
      // 3. Tout le reste qui le concerne.
      await Promise.all([
        Message.deleteMany({ $or: [{ conversationId: { $in: conversationIds } }, { senderId: me }] }),
        Conversation.deleteMany({ _id: { $in: conversationIds } }),
        Playlist.deleteMany({ ownerId: me }),
        Reaction.deleteMany({ userId: me }),
        TrackAccess.deleteMany({ $or: [{ userId: me }, { ownerId: me }] }),
        Friendship.deleteMany({ $or: [{ requesterId: me }, { recipientId: me }] }),
        Block.deleteMany({ $or: [{ blockerId: me }, { blockedId: me }] }),
        Notification.deleteMany({ $or: [{ userId: me }, { actorId: me }] }),
        RemixRequest.deleteMany({ $or: [{ requesterId: me }, { ownerId: me }] }),
        MixProject.deleteMany({ ownerId: me }),
        ExternalTrack.deleteMany({ ownerId: me }),
        Report.deleteMany({ reporterId: me }),
        // Crédits des mixages des autres : le nom est remplacé, l'attribution reste.
        Track.updateMany({ "credits.sources.ownerId": user._id }, { $set: { "credits.sources.$[source].ownerName": "Compte supprimé" } }, { arrayFilters: [{ "source.ownerId": user._id }] }),
      ]);
      await user.deleteOne();
      revokeSessions(me);
      console.log(`[settings] Compte supprimé : ${me} (${tracks.length} piste(s), ${failedFiles.length} fichier(s) non effacé(s))`);
      if (failedFiles.length) {
        return res.status(500).json({ message: "Compte supprimé, mais certains fichiers n'ont pas pu être effacés du serveur. L'administrateur est prévenu par les journaux." });
      }
      res.status(204).end();
    } catch (error) {
      console.error("[settings] Erreur de suppression du compte", error);
      next(error);
    }
  });
}
