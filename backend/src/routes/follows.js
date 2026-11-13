/**
 * Abonnements : suivre un artiste (s'abonner) sans demande d'accord.
 * On ne voit que ses créations PUBLIQUES (fil d'activité, notifications à chaque
 * nouvelle publication publique). Un blocage, dans un sens ou dans l'autre,
 * empêche l'abonnement et supprime les abonnements existants.
 */
import mongoose from "mongoose";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { isBlockedBetween, notify } from "../social.js";

const validId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;

export function registerFollowRoutes(app, { auth }) {
  /** S'abonner à un artiste. */
  app.post("/api/users/:id/follow", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const target = req.params.id;
      if (!validId(target)) return res.status(404).json({ message: "Profil inconnu" });
      if (String(target) === String(me)) return res.status(400).json({ message: "Vous ne pouvez pas vous abonner à vous-même" });
      if (!(await User.exists({ _id: target }))) return res.status(404).json({ message: "Profil inconnu" });
      if (await isBlockedBetween(me, target)) return res.status(403).json({ message: "Impossible de suivre cette personne" });
      const result = await Follow.updateOne({ followerId: me, followedId: target }, { $setOnInsert: { followerId: me, followedId: target } }, { upsert: true });
      if (result.upsertedCount) await notify({ userId: target, type: "follow", actorId: me });
      const followers = await Follow.countDocuments({ followedId: target });
      console.log(`[follows] ${me} suit ${target}`);
      res.status(result.upsertedCount ? 201 : 200).json({ following: true, followers });
    } catch (error) {
      console.error("[follows] Erreur d'abonnement", error);
      next(error);
    }
  });

  /** Se désabonner. */
  app.delete("/api/users/:id/follow", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Profil inconnu" });
      await Follow.deleteOne({ followerId: req.auth.sub, followedId: req.params.id });
      const followers = await Follow.countDocuments({ followedId: req.params.id });
      res.json({ following: false, followers });
    } catch (error) {
      console.error("[follows] Erreur de désabonnement", error);
      next(error);
    }
  });

  /** Les artistes que je suis, et ceux qui me suivent. */
  app.get("/api/me/follows", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const [following, followers] = await Promise.all([
        Follow.find({ followerId: me }).sort({ createdAt: -1 }).limit(500).lean(),
        Follow.find({ followedId: me }).sort({ createdAt: -1 }).limit(500).lean(),
      ]);
      const users = await User.find({ _id: { $in: [...following.map((f) => f.followedId), ...followers.map((f) => f.followerId)] } }).select("name").lean();
      const names = new Map(users.map((user) => [String(user._id), user.name]));
      const view = (id, at) => ({ user: { id: String(id), name: names.get(String(id)) ?? "Compte supprimé" }, since: at });
      res.json({
        following: following.map((follow) => view(follow.followedId, follow.createdAt)),
        followers: followers.map((follow) => view(follow.followerId, follow.createdAt)),
      });
    } catch (error) {
      console.error("[follows] Erreur de lecture", error);
      next(error);
    }
  });
}
