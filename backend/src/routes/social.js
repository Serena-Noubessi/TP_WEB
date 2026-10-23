/**
 * Routes MOST VIBE de la section 6 (et notifications) :
 * - recherche de profils et profil public ;
 * - invitations (envoyer, accepter, refuser, annuler), liste d'amis, retrait ;
 * - blocage ;
 * - fil d'activité des amis (uniquement ce que le lecteur a le droit de voir) ;
 * - notifications et compteurs « non lus ».
 */
import mongoose from "mongoose";
import { literalRegex, readableMatch } from "../access.js";
import { Block } from "../models/Block.js";
import { Conversation } from "../models/Conversation.js";
import { Friendship, pairKey } from "../models/Friendship.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { Track } from "../models/Track.js";
import { TrackAccess } from "../models/TrackAccess.js";
import { User } from "../models/User.js";
import { friendIds, hiddenIds, isBlockedBetween, notify } from "../social.js";
import { AUTHOR_LOOKUP, PUBLIC_FIELDS } from "./public.js";

const oid = (value) => new mongoose.Types.ObjectId(String(value));
const validId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;
const summary = (user) => ({ id: String(user._id), name: user.name });

/**
 * Relation entre « me » et une liste de comptes :
 * friend, outgoing (invitation envoyée), incoming (invitation reçue) ou none.
 */
async function relations(me, userIds) {
  const links = await Friendship.find({ pairKey: { $in: userIds.map((id) => pairKey(me, id)) } }).lean();
  const result = new Map();
  for (const link of links) {
    const other = String(String(link.requesterId) === String(me) ? link.recipientId : link.requesterId);
    const relation = link.status === "accepted" ? "friend" : String(link.requesterId) === String(me) ? "outgoing" : "incoming";
    result.set(other, { relation, requestId: link.status === "pending" ? String(link._id) : null });
  }
  return result;
}

/** Retire les accès « Amis choisis » qu'ownerId avait donnés à userId. */
async function revokeShares(ownerId, userId, vias = ["share"]) {
  const result = await TrackAccess.updateMany({ ownerId, userId, via: { $in: vias }, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return result.modifiedCount;
}

export function registerSocialRoutes(app, { auth }) {
  /* ------------------------------------------------------------------ */
  /* Profils                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Recherche de profils par nom (2 caractères minimum, 10 résultats), avec la
   * relation de chacun. Jamais l'email. Les comptes bloqués (dans un sens ou
   * dans l'autre) n'apparaissent pas.
   */
  app.get("/api/users/search", auth, async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 60) : "";
      if (q.length < 2) return res.status(400).json({ message: "Tapez au moins 2 caractères" });
      const [hidden, friends] = await Promise.all([hiddenIds(req.auth.sub), friendIds(req.auth.sub)]);
      // Section 9 : un compte peut choisir de ne pas apparaître dans la recherche (ses amis le trouvent toujours).
      const users = await User.find({
        _id: { $nin: [req.auth.sub, ...hidden] },
        name: literalRegex(q),
        $or: [{ "privacy.showInSearch": { $ne: false } }, { _id: { $in: friends } }],
      })
        .select("name")
        .sort({ name: 1 })
        .limit(10)
        .lean();
      const rel = await relations(req.auth.sub, users.map((user) => user._id));
      res.json({ users: users.map((user) => ({ ...summary(user), ...(rel.get(String(user._id)) ?? { relation: "none", requestId: null }) })) });
    } catch (error) {
      console.error("[users] Erreur de recherche de profils", error);
      next(error);
    }
  });

  /** Profil public : nom, relation, nombre d'amis et pistes que le lecteur a le droit de voir. */
  app.get("/api/users/:id/profile", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Profil inconnu" });
      const me = req.auth.sub;
      if (String(req.params.id) !== String(me) && (await isBlockedBetween(me, req.params.id))) {
        return res.status(404).json({ message: "Profil inconnu" });
      }
      const user = await User.findById(req.params.id).select("name createdAt").lean();
      if (!user) return res.status(404).json({ message: "Profil inconnu" });
      const [rel, friendCount, readable] = await Promise.all([relations(me, [user._id]), Friendship.countDocuments({ status: "accepted", $or: [{ requesterId: user._id }, { recipientId: user._id }] }), readableMatch(me)]);
      const tracks = await Track.aggregate([{ $match: { ownerId: user._id } }, { $match: readable }, { $sort: { createdAt: -1 } }, { $limit: 24 }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]);
      const self = String(user._id) === String(me);
      res.json({
        ...summary(user),
        memberSince: user.createdAt,
        relation: self ? "self" : (rel.get(String(user._id))?.relation ?? "none"),
        requestId: rel.get(String(user._id))?.requestId ?? null,
        friendCount,
        tracks,
      });
    } catch (error) {
      console.error("[users] Erreur de lecture d'un profil", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Amis et invitations                                                 */
  /* ------------------------------------------------------------------ */

  /** Mes amis, mes invitations reçues et envoyées. */
  app.get("/api/friends", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const links = await Friendship.find({ $or: [{ requesterId: me }, { recipientId: me }] }).sort({ updatedAt: -1 }).lean();
      const otherOf = (link) => (String(link.requesterId) === String(me) ? link.recipientId : link.requesterId);
      const users = await User.find({ _id: { $in: links.map(otherOf) } }).select("name").lean();
      const names = new Map(users.map((user) => [String(user._id), user.name]));
      const view = (link) => ({ requestId: String(link._id), user: { id: String(otherOf(link)), name: names.get(String(otherOf(link))) ?? "Compte supprimé" }, createdAt: link.createdAt, acceptedAt: link.acceptedAt });
      res.json({
        friends: links.filter((link) => link.status === "accepted").map(view).sort((a, b) => a.user.name.localeCompare(b.user.name, "fr")),
        incoming: links.filter((link) => link.status === "pending" && String(link.recipientId) === String(me)).map(view),
        outgoing: links.filter((link) => link.status === "pending" && String(link.requesterId) === String(me)).map(view),
      });
    } catch (error) {
      console.error("[friends] Erreur de lecture", error);
      next(error);
    }
  });

  /**
   * Envoie une invitation. Si l'autre personne m'avait déjà invité, l'invitation
   * est acceptée directement (amis).
   */
  app.post("/api/friends/requests", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const target = req.body?.userId;
      if (!validId(target)) return res.status(400).json({ message: "userId invalide" });
      if (String(target) === String(me)) return res.status(400).json({ message: "Vous ne pouvez pas vous inviter vous-même" });
      const targetUser = await User.findById(target).select("privacy").lean();
      if (!targetUser) return res.status(404).json({ message: "Profil inconnu" });
      if (await isBlockedBetween(me, target)) return res.status(403).json({ message: "Impossible d'inviter cette personne" });

      const existing = await Friendship.findOne({ pairKey: pairKey(me, target) });
      if (existing?.status === "accepted") return res.status(409).json({ message: "Vous êtes déjà amis" });
      if (existing && String(existing.requesterId) === String(me)) return res.status(409).json({ message: "Invitation déjà envoyée" });
      if (existing) {
        existing.status = "accepted";
        existing.acceptedAt = new Date();
        await existing.save();
        await notify({ userId: target, type: "friend_accepted", actorId: me });
        console.log(`[friends] Invitations croisées : ${me} et ${target} deviennent amis`);
        return res.status(200).json({ requestId: existing.id, status: "accepted" });
      }
      // Section 9 : un compte peut refuser toute nouvelle invitation (une invitation croisée reste acceptée ci-dessus).
      if (targetUser.privacy?.allowFriendRequests === false) return res.status(403).json({ message: "Cette personne n'accepte pas d'invitations pour le moment" });
      const request = await Friendship.create({ requesterId: me, recipientId: target, pairKey: pairKey(me, target) });
      await notify({ userId: target, type: "friend_request", actorId: me });
      console.log(`[friends] Invitation ${request.id} : ${me} → ${target}`);
      res.status(201).json({ requestId: request.id, status: "pending" });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ message: "Invitation déjà en cours" });
      console.error("[friends] Erreur d'invitation", error);
      next(error);
    }
  });

  /** Accepte une invitation reçue. */
  app.post("/api/friends/requests/:id/accept", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Invitation inconnue" });
      const request = await Friendship.findOneAndUpdate(
        { _id: req.params.id, recipientId: req.auth.sub, status: "pending" },
        { $set: { status: "accepted", acceptedAt: new Date() } },
        { new: true },
      );
      if (!request) return res.status(404).json({ message: "Invitation inconnue" });
      await notify({ userId: request.requesterId, type: "friend_accepted", actorId: req.auth.sub });
      console.log(`[friends] Invitation acceptée : ${request.id}`);
      res.json({ requestId: request.id, status: "accepted" });
    } catch (error) {
      console.error("[friends] Erreur d'acceptation", error);
      next(error);
    }
  });

  /** Refuse une invitation reçue (elle est supprimée ; l'autre n'est pas prévenu). */
  app.post("/api/friends/requests/:id/refuse", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Invitation inconnue" });
      const request = await Friendship.findOneAndDelete({ _id: req.params.id, recipientId: req.auth.sub, status: "pending" });
      if (!request) return res.status(404).json({ message: "Invitation inconnue" });
      await Notification.deleteMany({ userId: req.auth.sub, type: "friend_request", actorId: request.requesterId });
      res.status(204).end();
    } catch (error) {
      console.error("[friends] Erreur de refus", error);
      next(error);
    }
  });

  /** Annule une invitation que j'ai envoyée. */
  app.delete("/api/friends/requests/:id", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Invitation inconnue" });
      const request = await Friendship.findOneAndDelete({ _id: req.params.id, requesterId: req.auth.sub, status: "pending" });
      if (!request) return res.status(404).json({ message: "Invitation inconnue" });
      await Notification.deleteMany({ userId: request.recipientId, type: "friend_request", actorId: req.auth.sub, readAt: null });
      res.status(204).end();
    } catch (error) {
      console.error("[friends] Erreur d'annulation", error);
      next(error);
    }
  });

  /**
   * Retire un ami. Les accès « Amis choisis » donnés dans les deux sens sont
   * retirés (on ne partage avec « Amis choisis » qu'avec ses amis).
   */
  app.delete("/api/friends/:userId", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      if (!validId(req.params.userId)) return res.status(404).json({ message: "Ami inconnu" });
      const link = await Friendship.findOneAndDelete({ pairKey: pairKey(me, req.params.userId), status: "accepted" });
      if (!link) return res.status(404).json({ message: "Ami inconnu" });
      const revoked = (await revokeShares(me, req.params.userId)) + (await revokeShares(req.params.userId, me));
      console.log(`[friends] Amitié retirée : ${me} / ${req.params.userId}, accès retirés : ${revoked}`);
      res.json({ removed: true, revokedAccesses: revoked });
    } catch (error) {
      console.error("[friends] Erreur de retrait d'ami", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Blocage                                                             */
  /* ------------------------------------------------------------------ */

  /** Comptes que j'ai bloqués. */
  app.get("/api/blocks", auth, async (req, res, next) => {
    try {
      const blocks = await Block.find({ blockerId: req.auth.sub }).sort({ createdAt: -1 }).lean();
      const users = await User.find({ _id: { $in: blocks.map((block) => block.blockedId) } }).select("name").lean();
      const names = new Map(users.map((user) => [String(user._id), user.name]));
      res.json({ blocked: blocks.map((block) => ({ user: { id: String(block.blockedId), name: names.get(String(block.blockedId)) ?? "Compte supprimé" }, blockedAt: block.createdAt })) });
    } catch (error) {
      console.error("[blocks] Erreur de lecture", error);
      next(error);
    }
  });

  /**
   * Bloque un compte : supprime l'amitié et les invitations entre nous, et retire
   * TOUS les accès que je lui avais donnés (partages et pistes envoyées par message).
   */
  app.post("/api/blocks", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const target = req.body?.userId;
      if (!validId(target)) return res.status(400).json({ message: "userId invalide" });
      if (String(target) === String(me)) return res.status(400).json({ message: "Vous ne pouvez pas vous bloquer vous-même" });
      if (!(await User.exists({ _id: target }))) return res.status(404).json({ message: "Profil inconnu" });
      await Block.updateOne({ blockerId: me, blockedId: target }, { $setOnInsert: { blockerId: me, blockedId: target } }, { upsert: true });
      await Friendship.deleteOne({ pairKey: pairKey(me, target) });
      const revoked = (await revokeShares(me, target, ["share", "message"])) + (await revokeShares(target, me));
      await Notification.deleteMany({ $or: [{ userId: me, actorId: target }, { userId: target, actorId: me, readAt: null }] });
      console.log(`[blocks] ${me} bloque ${target} (accès retirés : ${revoked})`);
      res.status(201).json({ blocked: true, revokedAccesses: revoked });
    } catch (error) {
      console.error("[blocks] Erreur de blocage", error);
      next(error);
    }
  });

  /** Débloque un compte (l'amitié n'est pas rétablie : il faut une nouvelle invitation). */
  app.delete("/api/blocks/:userId", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.userId)) return res.status(404).json({ message: "Blocage inconnu" });
      const result = await Block.deleteOne({ blockerId: req.auth.sub, blockedId: req.params.userId });
      if (!result.deletedCount) return res.status(404).json({ message: "Blocage inconnu" });
      res.status(204).end();
    } catch (error) {
      console.error("[blocks] Erreur de déblocage", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Fil d'activité                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Dernières pistes et mixages publiés par mes amis, limités à ce que j'ai le
   * droit d'écouter (publiques, ou partagées avec moi). Une piste privée d'un
   * ami n'apparaît jamais.
   */
  app.get("/api/feed", auth, async (req, res, next) => {
    try {
      const friends = await friendIds(req.auth.sub);
      if (!friends.length) return res.json({ items: [], friendCount: 0 });
      const readable = await readableMatch(req.auth.sub);
      const tracks = await Track.aggregate([
        { $match: { ownerId: { $in: friends.map(oid) } } },
        { $match: readable },
        { $sort: { createdAt: -1 } },
        { $limit: 30 },
        ...AUTHOR_LOOKUP,
        PUBLIC_FIELDS,
      ]);
      const items = tracks.map((track) => ({ type: track.kind === "mix" ? "mix_published" : "track_published", at: track.createdAt, actor: track.author, track }));
      res.json({ items, friendCount: friends.length });
    } catch (error) {
      console.error("[feed] Erreur du fil d'activité", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Notifications et compteurs                                          */
  /* ------------------------------------------------------------------ */

  /** 30 dernières notifications, avec le nom de leur auteur. */
  app.get("/api/notifications", auth, async (req, res, next) => {
    try {
      const items = await Notification.find({ userId: req.auth.sub }).sort({ updatedAt: -1 }).limit(30).lean();
      const users = await User.find({ _id: { $in: items.map((item) => item.actorId) } }).select("name").lean();
      const names = new Map(users.map((user) => [String(user._id), user.name]));
      const tracks = await Track.find({ _id: { $in: items.map((item) => item.trackId).filter(Boolean) } }).select("title").lean();
      const titles = new Map(tracks.map((track) => [String(track._id), track.title]));
      res.json({
        unread: items.filter((item) => !item.readAt).length,
        items: items.map((item) => ({
          id: String(item._id),
          type: item.type,
          actor: { id: String(item.actorId), name: names.get(String(item.actorId)) ?? "Compte supprimé" },
          count: item.count,
          conversationId: item.conversationId ? String(item.conversationId) : null,
          track: item.trackId || item.trackTitle ? { id: item.trackId ? String(item.trackId) : null, title: titles.get(String(item.trackId)) ?? item.trackTitle ?? null } : null,
          read: Boolean(item.readAt),
          at: item.updatedAt,
        })),
      });
    } catch (error) {
      console.error("[notifications] Erreur de lecture", error);
      next(error);
    }
  });

  /** Marque mes notifications comme lues (toutes, ou celles de `ids`). */
  app.post("/api/notifications/read", auth, async (req, res, next) => {
    try {
      const filter = { userId: req.auth.sub, readAt: null };
      if (Array.isArray(req.body?.ids)) filter._id = { $in: req.body.ids.filter(validId) };
      const result = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
      res.json({ updated: result.modifiedCount });
    } catch (error) {
      console.error("[notifications] Erreur de marquage", error);
      next(error);
    }
  });

  /** Compteurs pour les pastilles du menu : messages non lus, notifications non lues, invitations reçues. */
  app.get("/api/me/counters", auth, async (req, res, next) => {
    try {
      const me = oid(req.auth.sub);
      const conversations = await Conversation.find({ participants: me }).select("reads").lean();
      let messages = 0;
      for (const conversation of conversations) {
        const lastReadAt = conversation.reads.find((read) => String(read.userId) === String(me))?.lastReadAt ?? new Date(0);
        messages += await Message.countDocuments({ conversationId: conversation._id, senderId: { $ne: me }, createdAt: { $gt: lastReadAt } });
      }
      const [notifications, invitations] = await Promise.all([
        Notification.countDocuments({ userId: me, readAt: null }),
        Friendship.countDocuments({ recipientId: me, status: "pending" }),
      ]);
      res.json({ messages, notifications, invitations });
    } catch (error) {
      console.error("[counters] Erreur des compteurs", error);
      next(error);
    }
  });
}
