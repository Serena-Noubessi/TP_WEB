/**
 * Routes MOST VIBE de la section 7 : messagerie privée entre amis.
 * - une conversation par paire d'amis ;
 * - messages texte et cartes musicales (« Envoyer une de mes pistes ») ;
 * - envoyer une piste non publique donne accès à CE destinataire seulement ;
 * - les droits de chaque carte sont revérifiés à chaque lecture : si l'accès a
 *   été retiré ou la piste supprimée, la carte indique « Partage interrompu ».
 */
import mongoose from "mongoose";
import { canRead } from "../access.js";
import { Conversation } from "../models/Conversation.js";
import { pairKey } from "../models/Friendship.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { Track } from "../models/Track.js";
import { TrackAccess } from "../models/TrackAccess.js";
import { User } from "../models/User.js";
import { areFriends, isBlockedBetween, notify } from "../social.js";
import { AUTHOR_LOOKUP, PUBLIC_FIELDS } from "./public.js";

const oid = (value) => new mongoose.Types.ObjectId(String(value));
const validId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;
const otherOf = (conversation, me) => conversation.participants.find((id) => String(id) !== String(me));
const lastReadOf = (conversation, userId) => conversation.reads.find((read) => String(read.userId) === String(userId))?.lastReadAt ?? new Date(0);

/**
 * Enregistre la date de lecture d'UN participant, sans toucher à celle de
 * l'autre (deux mises à jour simultanées ne peuvent pas s'écraser).
 */
async function markRead(conversationId, userId, at, extra = {}) {
  const updated = await Conversation.updateOne({ _id: conversationId, "reads.userId": oid(userId) }, { $set: { "reads.$.lastReadAt": at, ...extra } });
  if (!updated.matchedCount) {
    await Conversation.updateOne({ _id: conversationId, "reads.userId": { $ne: oid(userId) } }, { $push: { reads: { userId: oid(userId), lastReadAt: at } }, ...(Object.keys(extra).length && { $set: extra }) });
  }
}

/** Charge une conversation dont l'utilisateur est participant (sinon 404, sans révéler qu'elle existe). */
async function myConversation(req, res) {
  if (!validId(req.params.id)) {
    res.status(404).json({ message: "Conversation inconnue" });
    return null;
  }
  const conversation = await Conversation.findOne({ _id: req.params.id, participants: oid(req.auth.sub) });
  if (!conversation) res.status(404).json({ message: "Conversation inconnue" });
  return conversation;
}

/**
 * Cartes musicales vues par `viewer` :
 * - status « ok » : le lecteur peut écouter la piste ;
 * - « interrupted » : l'accès a été retiré (ou la piste rendue privée) ;
 * - « deleted » : la piste n'existe plus.
 * L'expéditeur (propriétaire) voit aussi si le destinataire a encore accès.
 */
async function trackCards(messages, viewer, recipientOf) {
  const ids = [...new Set(messages.filter((message) => message.trackId).map((message) => String(message.trackId)))];
  if (!ids.length) return new Map();
  const [docs, publicDocs] = await Promise.all([
    Track.find({ _id: { $in: ids } }),
    Track.aggregate([{ $match: { _id: { $in: ids.map(oid) } } }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]),
  ]);
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const views = new Map(publicDocs.map((doc) => [doc.id, doc]));
  const cards = new Map();
  for (const message of messages) {
    if (!message.trackId) continue;
    const id = String(message.trackId);
    const track = byId.get(id);
    if (!track) {
      cards.set(String(message._id), { id, status: "deleted" });
      continue;
    }
    const status = (await canRead(track, viewer)) === "ok" ? "ok" : "interrupted";
    const card = status === "ok" ? { ...views.get(id), status } : { id, status, title: track.title, author: views.get(id)?.author ?? null };
    if (String(track.ownerId) === String(viewer)) {
      card.recipientAccess = (await canRead(track, recipientOf(message))) === "ok" ? "active" : "revoked";
    }
    cards.set(String(message._id), card);
  }
  return cards;
}

/** Format d'un message pour le frontend. */
function messageView(message, me, cards) {
  return {
    id: String(message._id),
    fromMe: String(message.senderId) === String(me),
    senderId: String(message.senderId),
    text: message.text,
    track: message.trackId ? cards.get(String(message._id)) ?? null : null,
    createdAt: message.createdAt,
  };
}

export function registerMessageRoutes(app, { auth }) {
  /** Mes conversations, de la plus récente à la plus ancienne, avec le nombre de messages non lus. */
  app.get("/api/conversations", auth, async (req, res, next) => {
    try {
      const me = oid(req.auth.sub);
      const conversations = await Conversation.find({ participants: me }).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(100).lean();
      const others = conversations.map((conversation) => otherOf(conversation, me));
      const users = await User.find({ _id: { $in: others } }).select("name").lean();
      const names = new Map(users.map((user) => [String(user._id), user.name]));
      const items = [];
      let totalUnread = 0;
      for (const conversation of conversations) {
        const other = otherOf(conversation, me);
        const [last, unread] = await Promise.all([
          Message.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 }).lean(),
          Message.countDocuments({ conversationId: conversation._id, senderId: { $ne: me }, createdAt: { $gt: lastReadOf(conversation, me) } }),
        ]);
        totalUnread += unread;
        items.push({
          id: String(conversation._id),
          other: { id: String(other), name: names.get(String(other)) ?? "Compte supprimé" },
          lastMessage: last ? { text: last.text, hasTrack: Boolean(last.trackId), fromMe: String(last.senderId) === String(me), at: last.createdAt } : null,
          unread,
        });
      }
      res.json({ conversations: items, unread: totalUnread });
    } catch (error) {
      console.error("[messages] Erreur de lecture des conversations", error);
      next(error);
    }
  });

  /** Ouvre (ou crée) la conversation avec un ami. */
  app.post("/api/conversations", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const target = req.body?.userId;
      if (!validId(target) || String(target) === String(me)) return res.status(400).json({ message: "userId invalide" });
      if (await isBlockedBetween(me, target)) return res.status(403).json({ message: "Vous ne pouvez pas écrire à cette personne" });
      if (!(await areFriends(me, target))) return res.status(403).json({ message: "La messagerie est réservée à vos amis" });
      const key = pairKey(me, target);
      let conversation = await Conversation.findOne({ pairKey: key });
      let status = 200;
      if (!conversation) {
        try {
          conversation = await Conversation.create({ participants: [oid(me), oid(target)], pairKey: key });
          status = 201;
        } catch (error) {
          if (error?.code !== 11000) throw error;
          conversation = await Conversation.findOne({ pairKey: key });
        }
      }
      const other = await User.findById(target).select("name").lean();
      res.status(status).json({ id: conversation.id, other: { id: String(target), name: other?.name ?? "Compte supprimé" } });
    } catch (error) {
      console.error("[messages] Erreur d'ouverture de conversation", error);
      next(error);
    }
  });

  /**
   * Messages d'une conversation (participants seulement), du plus ancien au plus
   * récent ; `before` (date ISO) charge les messages plus anciens.
   */
  app.get("/api/conversations/:id/messages", auth, async (req, res, next) => {
    try {
      const conversation = await myConversation(req, res);
      if (!conversation) return;
      const me = req.auth.sub;
      const limit = Math.min(100, Math.max(1, Math.trunc(Number(req.query.limit)) || 50));
      const filter = { conversationId: conversation._id };
      const before = req.query.before ? new Date(String(req.query.before)) : null;
      if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
      const messages = (await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean()).reverse();
      const hasMore = messages.length > limit;
      if (hasMore) messages.shift();
      const other = otherOf(conversation, me);
      const recipientOf = (message) => (String(message.senderId) === String(me) ? other : oid(me));
      const cards = await trackCards(messages, me, recipientOf);
      const otherUser = await User.findById(other).select("name").lean();
      const [friends, blocked] = await Promise.all([areFriends(me, other), isBlockedBetween(me, other)]);
      res.json({
        id: conversation.id,
        other: { id: String(other), name: otherUser?.name ?? "Compte supprimé" },
        canSend: friends && !blocked,
        reason: blocked ? "blocked" : friends ? null : "not_friends",
        otherLastReadAt: lastReadOf(conversation, other),
        hasMore,
        messages: messages.map((message) => messageView(message, me, cards)),
      });
    } catch (error) {
      console.error("[messages] Erreur de lecture des messages", error);
      next(error);
    }
  });

  /**
   * Envoie un message : `text` (2000 caractères au maximum) et/ou `trackId`
   * (une de MES pistes). Une piste non publique devient accessible au seul destinataire.
   */
  app.post("/api/conversations/:id/messages", auth, async (req, res, next) => {
    try {
      const conversation = await myConversation(req, res);
      if (!conversation) return;
      const me = req.auth.sub;
      const other = otherOf(conversation, me);
      if (await isBlockedBetween(me, other)) return res.status(403).json({ message: "Vous ne pouvez pas écrire à cette personne" });
      if (!(await areFriends(me, other))) return res.status(403).json({ message: "Vous n'êtes plus amis : la conversation est en lecture seule" });

      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      if (text.length > 2000) return res.status(400).json({ message: "Le message ne peut pas dépasser 2000 caractères" });
      let track = null;
      if (req.body?.trackId !== undefined && req.body?.trackId !== null) {
        if (!validId(req.body.trackId)) return res.status(400).json({ message: "trackId invalide" });
        track = await Track.findOne({ _id: req.body.trackId, ownerId: me });
        if (!track) return res.status(404).json({ message: "Piste inconnue : vous ne pouvez envoyer que vos propres pistes" });
      }
      if (!text && !track) return res.status(400).json({ message: "Message vide" });

      if (track && track.visibility !== "public") {
        // Accès réservé à ce destinataire. Un accès retiré auparavant est rétabli
        // (renvoyer la piste est un nouveau partage volontaire).
        const grant = await TrackAccess.findOne({ trackId: track._id, userId: other });
        if (!grant) await TrackAccess.create({ trackId: track._id, ownerId: me, userId: other, via: "message" });
        else if (grant.revokedAt) await TrackAccess.updateOne({ _id: grant._id }, { $set: { revokedAt: null, via: "message", grantedAt: new Date() } });
      }
      const message = await Message.create({ conversationId: conversation._id, senderId: me, text, trackId: track?._id ?? null });
      await markRead(conversation._id, me, message.createdAt, { lastMessageAt: message.createdAt });
      await notify({ userId: other, type: "message", actorId: me, conversationId: conversation._id });
      const cards = await trackCards([message], me, () => other);
      console.log(`[messages] Message ${message.id} envoyé dans ${conversation.id}${track ? ` avec la piste ${track.id}` : ""}`);
      res.status(201).json(messageView(message, me, cards));
    } catch (error) {
      console.error("[messages] Erreur d'envoi", error);
      next(error);
    }
  });

  /** Marque la conversation comme lue (et sa notification de messages). */
  app.post("/api/conversations/:id/read", auth, async (req, res, next) => {
    try {
      const conversation = await myConversation(req, res);
      if (!conversation) return;
      const me = req.auth.sub;
      const now = new Date();
      await markRead(conversation._id, me, now);
      await Notification.updateMany({ userId: me, type: "message", conversationId: conversation._id, readAt: null }, { $set: { readAt: now } });
      res.json({ lastReadAt: now });
    } catch (error) {
      console.error("[messages] Erreur de lecture", error);
      next(error);
    }
  });
}
