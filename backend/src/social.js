/**
 * Relations entre comptes (sections 6 et 7), utilisées par toutes les routes
 * qui doivent savoir si deux personnes sont amies ou si l'une a bloqué l'autre.
 */
import { Block } from "./models/Block.js";
import { Friendship, pairKey } from "./models/Friendship.js";
import { Notification } from "./models/Notification.js";
import { User } from "./models/User.js";

/** Vrai si a et b sont amis (invitation acceptée). */
export async function areFriends(a, b) {
  return Boolean(await Friendship.exists({ pairKey: pairKey(a, b), status: "accepted" }));
}

/** Vrai si l'un des deux a bloqué l'autre. */
export async function isBlockedBetween(a, b) {
  return Boolean(await Block.exists({ $or: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }));
}

/** Identifiants (chaînes) des amis de userId. */
export async function friendIds(userId) {
  const links = await Friendship.find({ status: "accepted", $or: [{ requesterId: userId }, { recipientId: userId }] }).select("requesterId recipientId").lean();
  return links.map((link) => String(String(link.requesterId) === String(userId) ? link.recipientId : link.requesterId));
}

/** Identifiants des comptes bloqués par userId ou qui ont bloqué userId (masqués partout). */
export async function hiddenIds(userId) {
  const blocks = await Block.find({ $or: [{ blockerId: userId }, { blockedId: userId }] }).select("blockerId blockedId").lean();
  return blocks.map((block) => String(String(block.blockerId) === String(userId) ? block.blockedId : block.blockerId));
}

/**
 * Crée une notification. Pour un message, la notification non lue de la même
 * conversation est réutilisée (son compteur augmente) au lieu d'en empiler une par message.
 * Une erreur de notification n'empêche jamais l'action principale : elle est seulement journalisée.
 */
export async function notify({ userId, type, actorId, conversationId = null, trackId = null, trackTitle = null }) {
  try {
    // Section 9 : l'utilisateur peut couper certains types (les avis de modération restent toujours envoyés).
    const pref = type.startsWith("remix_") ? "remix" : type;
    if (type !== "content_removed") {
      const user = await User.findById(userId).select("notificationPrefs").lean();
      if (user?.notificationPrefs?.[pref] === false) return;
    }
    if (type === "message") {
      await Notification.findOneAndUpdate(
        { userId, type, conversationId, readAt: null },
        { $inc: { count: 1 }, $set: { actorId }, $setOnInsert: { userId, type, conversationId } },
        { upsert: true },
      );
      return;
    }
    await Notification.create({ userId, type, actorId, conversationId, trackId, trackTitle });
  } catch (error) {
    console.error(`[notifications] Notification ${type} non créée pour ${userId}`, error);
  }
}
