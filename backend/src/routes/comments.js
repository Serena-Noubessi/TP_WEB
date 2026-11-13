/**
 * Commentaires (avis) sur une piste.
 * - lire : quiconque peut écouter la piste (un visiteur pour une piste publique) ;
 * - écrire : un membre connecté qui peut écouter la piste, sans blocage avec son auteur ;
 * - supprimer : l'auteur du commentaire, le propriétaire de la piste, ou un
 *   administrateur si la piste est publique (jamais sur un contenu privé).
 */
import mongoose from "mongoose";
import { canRead } from "../access.js";
import { Comment } from "../models/Comment.js";
import { Track } from "../models/Track.js";
import { User } from "../models/User.js";
import { hiddenIds, isBlockedBetween, notify } from "../social.js";

const validId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;
const PAGE = 30;

/** Vue d'un commentaire pour le frontend (nom de l'auteur seulement, jamais son email). */
function commentView(comment, names, viewer, trackOwnerId) {
  const mine = viewer && String(comment.authorId) === String(viewer);
  return {
    id: String(comment._id),
    text: comment.text,
    author: { id: String(comment.authorId), name: names.get(String(comment.authorId)) ?? "Compte supprimé" },
    createdAt: comment.createdAt,
    mine: Boolean(mine),
    canDelete: Boolean(mine || (viewer && String(trackOwnerId) === String(viewer))),
  };
}

/** Charge une piste et vérifie le droit de l'écouter ; envoie l'erreur sinon. */
async function readableTrack(req, res) {
  if (!validId(req.params.id)) {
    res.status(404).json({ message: "Piste inconnue" });
    return null;
  }
  const track = await Track.findById(req.params.id);
  if (!track) {
    res.status(404).json({ message: "Piste inconnue" });
    return null;
  }
  const access = await canRead(track, req.auth?.sub);
  if (access !== "ok") {
    res.status(access === "login" ? 401 : 403).json({ message: access === "login" ? "Connectez-vous pour voir les commentaires de cette piste" : "Vous n'avez pas accès à cette piste" });
    return null;
  }
  return track;
}

export function registerCommentRoutes(app, { auth, optionalAuth }) {
  /** Commentaires d'une piste, du plus récent au plus ancien (`before` : date ISO, pour la suite). */
  app.get("/api/tracks/:id/comments", optionalAuth, async (req, res, next) => {
    try {
      const track = await readableTrack(req, res);
      if (!track) return;
      const viewer = req.auth?.sub;
      const filter = { trackId: track._id };
      // Les commentaires des comptes bloqués (dans un sens ou dans l'autre) ne sont pas montrés.
      if (viewer) {
        const hidden = await hiddenIds(viewer);
        if (hidden.length) filter.authorId = { $nin: hidden };
      }
      const before = req.query.before ? new Date(String(req.query.before)) : null;
      if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
      const comments = await Comment.find(filter).sort({ createdAt: -1 }).limit(PAGE + 1).lean();
      const hasMore = comments.length > PAGE;
      if (hasMore) comments.pop();
      const users = await User.find({ _id: { $in: comments.map((comment) => comment.authorId) } }).select("name").lean();
      const names = new Map(users.map((user) => [String(user._id), user.name]));
      const total = await Comment.countDocuments({ trackId: track._id });
      res.json({
        total,
        hasMore,
        canComment: Boolean(viewer) && !(await isBlockedBetween(viewer, track.ownerId)),
        comments: comments.map((comment) => commentView(comment, names, viewer, track.ownerId)),
      });
    } catch (error) {
      console.error("[comments] Erreur de lecture", error);
      next(error);
    }
  });

  /** Ajoute un commentaire : { text } (1 à 1000 caractères). */
  app.post("/api/tracks/:id/comments", auth, async (req, res, next) => {
    try {
      const track = await readableTrack(req, res);
      if (!track) return;
      const me = req.auth.sub;
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      if (!text || text.length > 1000) return res.status(400).json({ message: "Le commentaire doit faire entre 1 et 1000 caractères" });
      if (await isBlockedBetween(me, track.ownerId)) return res.status(403).json({ message: "Vous ne pouvez pas commenter cette piste" });
      const comment = await Comment.create({ trackId: track._id, authorId: me, text });
      if (String(track.ownerId) !== String(me)) {
        await notify({ userId: track.ownerId, type: "comment", actorId: me, trackId: track._id, trackTitle: track.title });
      }
      const author = await User.findById(me).select("name").lean();
      console.log(`[comments] Commentaire ${comment.id} sur ${track.id} par ${me}`);
      res.status(201).json(commentView(comment.toObject(), new Map([[String(me), author?.name]]), me, track.ownerId));
    } catch (error) {
      console.error("[comments] Erreur d'ajout", error);
      next(error);
    }
  });

  /** Supprime un commentaire (auteur, propriétaire de la piste, ou admin si la piste est publique). */
  app.delete("/api/comments/:id", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Commentaire inconnu" });
      const comment = await Comment.findById(req.params.id);
      if (!comment) return res.status(404).json({ message: "Commentaire inconnu" });
      const me = String(req.auth.sub);
      const track = await Track.findById(comment.trackId).select("ownerId visibility").lean();
      let allowed = String(comment.authorId) === me || (track && String(track.ownerId) === me);
      if (!allowed && track?.visibility === "public") {
        const user = await User.findById(me).select("role suspendedAt").lean();
        allowed = user?.role === "admin" && !user.suspendedAt;
      }
      if (!allowed) return res.status(403).json({ message: "Vous ne pouvez pas supprimer ce commentaire" });
      await comment.deleteOne();
      console.log(`[comments] Commentaire ${comment.id} supprimé par ${me}`);
      res.status(204).end();
    } catch (error) {
      console.error("[comments] Erreur de suppression", error);
      next(error);
    }
  });
}
