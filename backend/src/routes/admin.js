/**
 * Routes MOST VIBE de la section 10 : signalements et administration.
 *
 * Sécurité :
 * - le rôle « admin » ne s'attribue qu'en ligne de commande sur le serveur
 *   (npm run role -- email admin), jamais par l'API ;
 * - requireAdmin relit le rôle EN BASE à chaque requête (un jeton ne suffit pas) ;
 * - l'administration agit sur les utilisateurs, les signalements et les contenus
 *   PUBLICS. Elle n'a aucune route vers les fichiers privés ni les conversations :
 *   une piste devenue privée ne peut être ni écoutée, ni dépubliée, ni supprimée par un admin.
 */
import mongoose from "mongoose";
import { canRead, literalRegex } from "../access.js";
import { REPORT_REASONS, Report } from "../models/Report.js";
import { Track } from "../models/Track.js";
import { User } from "../models/User.js";
import { restoreSessions, revokeSessions } from "../sessions.js";
import { notify } from "../social.js";
import { purgeTrack } from "../track-cleanup.js";
import { AUTHOR_LOOKUP, PUBLIC_FIELDS } from "./public.js";

const validId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Accès réservé aux administrateurs : rôle relu en base à chaque requête. */
async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.auth.sub).select("role suspendedAt").lean();
    if (user?.role !== "admin" || user.suspendedAt) {
      console.warn(`[admin] Accès refusé à ${req.auth.sub} pour ${req.method} ${req.path}`);
      return res.status(403).json({ message: "Réservé à l'administration" });
    }
    next();
  } catch (error) {
    next(error);
  }
}

/** Résumé de la cible d'un signalement, sans jamais exposer un contenu privé. */
async function targetSummaries(reports) {
  const trackIds = reports.filter((report) => report.targetType === "track").map((report) => report.targetId);
  const userIds = [...reports.map((report) => report.targetOwnerId), ...reports.map((report) => report.reporterId)];
  const [tracks, users] = await Promise.all([
    Track.find({ _id: { $in: trackIds } }).select("title visibility kind coverStoredName ownerId").lean(),
    User.find({ _id: { $in: userIds } }).select("name suspendedAt").lean(),
  ]);
  const trackMap = new Map(tracks.map((track) => [String(track._id), track]));
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  return reports.map((report) => {
    const owner = userMap.get(String(report.targetOwnerId));
    const track = report.targetType === "track" ? trackMap.get(String(report.targetId)) : null;
    const isPublic = track?.visibility === "public";
    return {
      id: String(report._id),
      targetType: report.targetType,
      reason: report.reason,
      details: report.details,
      status: report.status,
      action: report.action,
      note: report.note,
      createdAt: report.createdAt,
      handledAt: report.handledAt,
      reporter: { id: String(report.reporterId), name: userMap.get(String(report.reporterId))?.name ?? "Compte supprimé" },
      owner: { id: String(report.targetOwnerId), name: owner?.name ?? "Compte supprimé", suspended: Boolean(owner?.suspendedAt) },
      // Une piste qui n'est plus publique est hors de portée : seul son état est indiqué.
      track:
        report.targetType === "track"
          ? track
            ? isPublic
              ? { id: String(track._id), title: track.title, kind: track.kind, visibility: track.visibility, coverUrl: track.coverStoredName ? `/api/tracks/${track._id}/cover` : null }
              : { id: String(track._id), title: null, visibility: track.visibility, hidden: true }
            : { id: String(report.targetId), deleted: true }
          : null,
    };
  });
}

/** Retire une piste publique (dépublication ou suppression), en prévenant son auteur. */
async function moderateTrack(track, action, adminId) {
  if (action === "unpublish") {
    await Track.updateOne({ _id: track._id }, { $set: { visibility: "private" } });
  } else {
    const full = await Track.findByIdAndDelete(track._id).select("+storedName +coverStoredName");
    if (full) await purgeTrack(full);
  }
  await notify({ userId: track.ownerId, type: "content_removed", actorId: adminId, trackId: action === "unpublish" ? track._id : null, trackTitle: track.title });
  console.log(`[admin] Piste ${track._id} : ${action === "unpublish" ? "dépubliée" : "supprimée"} par ${adminId}`);
}

async function suspendUser(userId, reason, adminId) {
  const user = await User.findById(userId);
  if (!user) return { status: 404, message: "Utilisateur inconnu" };
  if (user.role === "admin") return { status: 400, message: "Un administrateur ne peut pas être suspendu depuis l'interface" };
  if (String(user._id) === String(adminId)) return { status: 400, message: "Vous ne pouvez pas vous suspendre vous-même" };
  user.suspendedAt = new Date();
  user.suspendedReason = reason;
  await user.save();
  revokeSessions(user._id);
  console.log(`[admin] Compte ${user.id} suspendu par ${adminId}`);
  return { status: 200 };
}

export function registerAdminRoutes(app, { auth }) {
  /* ------------------------------------------------------------------ */
  /* Signaler (tous les utilisateurs connectés)                          */
  /* ------------------------------------------------------------------ */

  /** Signale une piste que je peux écouter, ou un profil : { targetType, targetId, reason, details? }. */
  app.post("/api/reports", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const { targetType, targetId, reason } = req.body ?? {};
      if (!["track", "user"].includes(targetType)) return res.status(400).json({ message: "targetType : track ou user" });
      if (!validId(targetId)) return res.status(400).json({ message: "targetId invalide" });
      if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ message: `Motif inconnu : ${REPORT_REASONS.join(", ")}` });
      let targetOwnerId;
      if (targetType === "track") {
        const track = await Track.findById(targetId);
        if (!track || (await canRead(track, me)) !== "ok") return res.status(404).json({ message: "Piste inconnue" });
        if (String(track.ownerId) === String(me)) return res.status(400).json({ message: "Vous ne pouvez pas signaler votre propre piste" });
        targetOwnerId = track.ownerId;
      } else {
        if (String(targetId) === String(me)) return res.status(400).json({ message: "Vous ne pouvez pas vous signaler vous-même" });
        if (!(await User.exists({ _id: targetId }))) return res.status(404).json({ message: "Profil inconnu" });
        targetOwnerId = targetId;
      }
      if (await Report.exists({ reporterId: me, targetType, targetId, status: "open" })) {
        return res.status(409).json({ message: "Vous avez déjà signalé ce contenu ; il est en cours d'examen" });
      }
      const report = await Report.create({ reporterId: me, targetType, targetId, targetOwnerId, reason, details: text(req.body?.details, 500) });
      console.log(`[reports] Signalement ${report.id} : ${targetType} ${targetId} (${reason})`);
      res.status(201).json({ id: report.id, status: report.status });
    } catch (error) {
      console.error("[reports] Erreur de signalement", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Administration                                                      */
  /* ------------------------------------------------------------------ */

  /** Tableau de bord : quelques chiffres. */
  app.get("/api/admin/overview", auth, requireAdmin, async (_req, res, next) => {
    try {
      const [users, suspended, tracks, publicTracks, openReports] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ suspendedAt: { $ne: null } }),
        Track.countDocuments(),
        Track.countDocuments({ visibility: "public" }),
        Report.countDocuments({ status: "open" }),
      ]);
      res.json({ users, suspended, tracks, publicTracks, openReports });
    } catch (error) {
      next(error);
    }
  });

  /** Signalements (status=open par défaut, ou resolved / dismissed / all). */
  app.get("/api/admin/reports", auth, requireAdmin, async (req, res, next) => {
    try {
      const status = ["open", "resolved", "dismissed", "all"].includes(req.query.status) ? req.query.status : "open";
      const reports = await Report.find(status === "all" ? {} : { status }).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ reports: await targetSummaries(reports) });
    } catch (error) {
      console.error("[admin] Erreur de lecture des signalements", error);
      next(error);
    }
  });

  /**
   * Traite un signalement : { action: "dismiss" | "unpublish" | "delete" | "suspend", note? }.
   * unpublish et delete ne s'appliquent qu'à une piste PUBLIQUE.
   */
  app.post("/api/admin/reports/:id/resolve", auth, requireAdmin, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Signalement inconnu" });
      const report = await Report.findOne({ _id: req.params.id, status: "open" });
      if (!report) return res.status(404).json({ message: "Signalement inconnu ou déjà traité" });
      const action = req.body?.action;
      if (!["dismiss", "unpublish", "delete", "suspend"].includes(action)) return res.status(400).json({ message: "Action : dismiss, unpublish, delete ou suspend" });
      const note = text(req.body?.note, 500);

      if (action === "unpublish" || action === "delete") {
        if (report.targetType !== "track") return res.status(400).json({ message: "Cette action concerne une piste" });
        const track = await Track.findById(report.targetId);
        if (!track) return res.status(404).json({ message: "La piste n'existe plus" });
        if (track.visibility !== "public") return res.status(403).json({ message: "Contenu non public : hors de portée de l'administration" });
        await moderateTrack(track, action, req.auth.sub);
      }
      if (action === "suspend") {
        const result = await suspendUser(report.targetOwnerId, note || `Signalement : ${report.reason}`, req.auth.sub);
        if (result.status !== 200) return res.status(result.status).json({ message: result.message });
      }
      report.status = action === "dismiss" ? "dismissed" : "resolved";
      report.action = { dismiss: "none", unpublish: "unpublished", delete: "deleted", suspend: "suspended" }[action];
      report.note = note;
      report.handledBy = req.auth.sub;
      report.handledAt = new Date();
      await report.save();
      // Les autres signalements ouverts sur la même cible sont clos avec la même décision.
      if (action !== "dismiss") {
        await Report.updateMany(
          { _id: { $ne: report._id }, targetType: report.targetType, targetId: report.targetId, status: "open" },
          { $set: { status: "resolved", action: report.action, note, handledBy: req.auth.sub, handledAt: report.handledAt } },
        );
      }
      res.json((await targetSummaries([report.toObject()]))[0]);
    } catch (error) {
      console.error("[admin] Erreur de traitement d'un signalement", error);
      next(error);
    }
  });

  /** Utilisateurs (recherche par nom ou email), avec leurs compteurs. */
  app.get("/api/admin/users", auth, requireAdmin, async (req, res, next) => {
    try {
      const q = text(req.query.q, 100);
      const filter = q ? { $or: [{ name: literalRegex(q) }, { email: literalRegex(q) }] } : {};
      const users = await User.find(filter).select("name email role createdAt suspendedAt suspendedReason").sort({ createdAt: -1 }).limit(50).lean();
      const ids = users.map((user) => user._id);
      const [trackCounts, publicCounts, reportCounts] = await Promise.all([
        Track.aggregate([{ $match: { ownerId: { $in: ids } } }, { $group: { _id: "$ownerId", n: { $sum: 1 } } }]),
        Track.aggregate([{ $match: { ownerId: { $in: ids }, visibility: "public" } }, { $group: { _id: "$ownerId", n: { $sum: 1 } } }]),
        Report.aggregate([{ $match: { targetOwnerId: { $in: ids }, status: "open" } }, { $group: { _id: "$targetOwnerId", n: { $sum: 1 } } }]),
      ]);
      const count = (list, id) => list.find((item) => String(item._id) === String(id))?.n ?? 0;
      res.json({
        users: users.map((user) => ({
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role ?? "user",
          createdAt: user.createdAt,
          suspendedAt: user.suspendedAt ?? null,
          suspendedReason: user.suspendedReason ?? "",
          tracks: count(trackCounts, user._id),
          publicTracks: count(publicCounts, user._id),
          openReports: count(reportCounts, user._id),
        })),
      });
    } catch (error) {
      console.error("[admin] Erreur de lecture des utilisateurs", error);
      next(error);
    }
  });

  /** Suspend un compte : { reason }. Ses jetons sont refusés immédiatement. */
  app.post("/api/admin/users/:id/suspend", auth, requireAdmin, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Utilisateur inconnu" });
      const reason = text(req.body?.reason, 300);
      if (!reason) return res.status(400).json({ message: "Indiquez la raison de la suspension" });
      const result = await suspendUser(req.params.id, reason, req.auth.sub);
      if (result.status !== 200) return res.status(result.status).json({ message: result.message });
      res.json({ suspended: true });
    } catch (error) {
      console.error("[admin] Erreur de suspension", error);
      next(error);
    }
  });

  /** Lève la suspension d'un compte. */
  app.delete("/api/admin/users/:id/suspend", auth, requireAdmin, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Utilisateur inconnu" });
      const user = await User.findOneAndUpdate({ _id: req.params.id, suspendedAt: { $ne: null } }, { $set: { suspendedAt: null, suspendedReason: "" } });
      if (!user) return res.status(404).json({ message: "Compte inconnu ou non suspendu" });
      restoreSessions(user._id);
      console.log(`[admin] Suspension levée pour ${user.id} par ${req.auth.sub}`);
      res.json({ suspended: false });
    } catch (error) {
      console.error("[admin] Erreur de levée de suspension", error);
      next(error);
    }
  });

  /** Contenus PUBLICS uniquement (recherche par titre), avec le nombre de signalements ouverts. */
  app.get("/api/admin/tracks", auth, requireAdmin, async (req, res, next) => {
    try {
      const q = text(req.query.q, 100);
      const match = { visibility: "public", ...(q && { title: literalRegex(q) }) };
      const tracks = await Track.aggregate([{ $match: match }, { $sort: { createdAt: -1 } }, { $limit: 50 }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]);
      const reports = await Report.aggregate([
        { $match: { targetType: "track", status: "open", targetId: { $in: tracks.map((track) => new mongoose.Types.ObjectId(track.id)) } } },
        { $group: { _id: "$targetId", n: { $sum: 1 } } },
      ]);
      res.json({ tracks: tracks.map((track) => ({ ...track, openReports: reports.find((item) => String(item._id) === track.id)?.n ?? 0 })) });
    } catch (error) {
      console.error("[admin] Erreur de lecture des contenus", error);
      next(error);
    }
  });

  for (const [method, route, action] of [["post", "/api/admin/tracks/:id/unpublish", "unpublish"], ["delete", "/api/admin/tracks/:id", "delete"]]) {
    /** Dépublie (rend privée) ou supprime une piste PUBLIQUE ; son auteur est prévenu. */
    app[method](route, auth, requireAdmin, async (req, res, next) => {
      try {
        if (!validId(req.params.id)) return res.status(404).json({ message: "Piste inconnue" });
        const track = await Track.findById(req.params.id);
        if (!track) return res.status(404).json({ message: "Piste inconnue" });
        if (track.visibility !== "public") return res.status(403).json({ message: "Contenu non public : hors de portée de l'administration" });
        await moderateTrack(track, action, req.auth.sub);
        await Report.updateMany(
          { targetType: "track", targetId: track._id, status: "open" },
          { $set: { status: "resolved", action: action === "unpublish" ? "unpublished" : "deleted", handledBy: req.auth.sub, handledAt: new Date() } },
        );
        if (action === "delete") return res.status(204).end();
        res.json({ unpublished: true });
      } catch (error) {
        console.error(`[admin] Erreur (${action})`, error);
        next(error);
      }
    });
  }
}
