/**
 * Routes MOST VIBE de l'étape 2 (sections 4 et 5) :
 * - réactions : j'aime et favoris ;
 * - espace personnel : favoris, pistes partagées avec moi, albums ;
 * - accès individuels à une piste (« Amis choisis ») : liste, ajout, retrait ;
 * - playlists ;
 * - morceaux en ligne (références enregistrées en base au lieu du navigateur).
 *
 * Toutes les décisions d'accès sont prises ici, par le serveur, à chaque requête.
 */
import mongoose from "mongoose";
import { canRead, readableMatch } from "../access.js";
import { STYLES } from "../constants.js";
import { ExternalTrack } from "../models/ExternalTrack.js";
import { Playlist } from "../models/Playlist.js";
import { Reaction } from "../models/Reaction.js";
import { Track } from "../models/Track.js";
import { TrackAccess } from "../models/TrackAccess.js";
import { User } from "../models/User.js";
import { AUTHOR_LOOKUP, PUBLIC_FIELDS } from "./public.js";
import { friendIds, notify } from "../social.js";

/** Message affiché au propriétaire chaque fois qu'il retire un accès (section 5). */
export const REVOKE_NOTICE =
  "L'accès est retiré : cette personne ne peut plus écouter ni télécharger la piste. " +
  "Un fichier qu'elle aurait déjà téléchargé ne peut pas être récupéré à distance.";

const oid = (value) => new mongoose.Types.ObjectId(String(value));
const validId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;
const notFound = (res, what = "Piste inconnue") => res.status(404).json({ message: what });

/** Pistes (champs publics + auteur) dans l'ordre des identifiants donnés. */
async function publicTracks(ids, extraMatch = {}) {
  if (!ids.length) return [];
  const docs = await Track.aggregate([{ $match: { _id: { $in: ids }, ...extraMatch } }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]);
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

/**
 * Charge une piste et vérifie que l'utilisateur peut la lire. Renvoie la piste
 * ou envoie elle-même la réponse d'erreur (404 / 403) et renvoie null.
 */
async function readableTrack(req, res) {
  if (!validId(req.params.id)) return notFound(res) && null;
  const track = await Track.findById(req.params.id);
  if (!track) return notFound(res) && null;
  const access = await canRead(track, req.auth.sub);
  if (access !== "ok") {
    console.warn(`[library] Piste non accessible pour ${req.auth.sub} : ${track.id}`);
    res.status(403).json({ message: "Vous n'avez pas accès à cette piste" });
    return null;
  }
  return track;
}

/** Charge une piste appartenant à l'utilisateur connecté (sinon 404, sans dire si elle existe). */
async function ownedTrack(req, res) {
  if (!validId(req.params.id)) return notFound(res) && null;
  const track = await Track.findOne({ _id: req.params.id, ownerId: req.auth.sub });
  if (!track) {
    console.warn(`[access] Piste inconnue ou pas propriétaire : ${req.params.id} (${req.auth.sub})`);
    return notFound(res) && null;
  }
  return track;
}

/** Liste des personnes ayant (ou ayant eu) accès à une piste. */
async function accessList(track) {
  const grants = await TrackAccess.find({ trackId: track._id }).sort({ grantedAt: -1 }).lean();
  const users = await User.find({ _id: { $in: grants.map((grant) => grant.userId) } }).select("name").lean();
  const names = new Map(users.map((user) => [String(user._id), user.name]));
  return {
    trackId: track.id,
    visibility: track.visibility,
    grants: grants.map((grant) => ({
      user: { id: String(grant.userId), name: names.get(String(grant.userId)) ?? "Compte supprimé" },
      via: grant.via,
      grantedAt: grant.grantedAt,
      revokedAt: grant.revokedAt,
      active: !grant.revokedAt,
    })),
  };
}

const HTTP_URL = /^https?:\/\/[^\s]+$/i;

/** Valide un morceau en ligne envoyé par le navigateur. */
function externalFields(body) {
  const item = body ?? {};
  const errors = [];
  const str = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const url = (value) => {
    const text = str(value, 2000);
    return HTTP_URL.test(text) ? text : null;
  };
  const fields = {
    title: str(item.title, 200),
    artist: str(item.artist, 120) || "Artiste inconnu",
    audioUrl: url(item.audioUrl),
    sourceId: str(item.sourceId, 40),
    sourceLabel: str(item.sourceLabel, 120),
    pageUrl: url(item.pageUrl),
    license: str(item.license, 120) || "Licence non précisée",
    licenseUrl: url(item.licenseUrl),
    imageUrl: url(item.imageUrl),
    durationSeconds: Number.isFinite(Number(item.durationSeconds)) && Number(item.durationSeconds) >= 0 ? Number(item.durationSeconds) : null,
    style: STYLES.includes(item.style) ? item.style : "autres",
    originalName: str(item.originalName, 300),
    mimeType: str(item.mimeType, 100) || "audio/mpeg",
    size: Number.isFinite(Number(item.size)) && Number(item.size) >= 0 ? Number(item.size) : 0,
  };
  if (!fields.title) errors.push("Titre requis");
  if (!fields.audioUrl) errors.push("Adresse audio invalide (http ou https requis)");
  if (!fields.sourceId || !fields.sourceLabel) errors.push("Source requise");
  return { fields, errors };
}

export function registerLibraryRoutes(app, { auth }) {
  /* ------------------------------------------------------------------ */
  /* Réactions : j'aime et favoris                                       */
  /* ------------------------------------------------------------------ */

  for (const [segment, type] of [["like", "like"], ["favorite", "favorite"]]) {
    /** Ajoute la réaction (idempotent : la refaire ne crée pas de doublon). */
    app.post(`/api/tracks/:id/${segment}`, auth, async (req, res, next) => {
      try {
        const track = await readableTrack(req, res);
        if (!track) return;
        await Reaction.updateOne({ userId: req.auth.sub, trackId: track._id, type }, { $setOnInsert: { userId: req.auth.sub, trackId: track._id, type } }, { upsert: true });
        const likeCount = await Reaction.countDocuments({ trackId: track._id, type: "like" });
        console.log(`[reactions] ${type} ajouté par ${req.auth.sub} sur ${track.id}`);
        res.json({ trackId: track.id, type, active: true, likeCount });
      } catch (error) {
        console.error(`[reactions] Erreur d'ajout ${type}`, error);
        next(error);
      }
    });

    /** Retire la réaction (sans erreur si elle n'existait pas). */
    app.delete(`/api/tracks/:id/${segment}`, auth, async (req, res, next) => {
      try {
        if (!validId(req.params.id)) return notFound(res);
        await Reaction.deleteOne({ userId: req.auth.sub, trackId: req.params.id, type });
        const likeCount = await Reaction.countDocuments({ trackId: req.params.id, type: "like" });
        console.log(`[reactions] ${type} retiré par ${req.auth.sub} sur ${req.params.id}`);
        res.json({ trackId: req.params.id, type, active: false, likeCount });
      } catch (error) {
        console.error(`[reactions] Erreur de retrait ${type}`, error);
        next(error);
      }
    });
  }

  /** Identifiants des pistes aimées et mises en favori par l'utilisateur. */
  app.get("/api/me/reactions", auth, async (req, res, next) => {
    try {
      const reactions = await Reaction.find({ userId: req.auth.sub }).select("trackId type").lean();
      res.json({
        likes: reactions.filter((item) => item.type === "like").map((item) => String(item.trackId)),
        favorites: reactions.filter((item) => item.type === "favorite").map((item) => String(item.trackId)),
      });
    } catch (error) {
      console.error("[reactions] Erreur de lecture des réactions", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Espace personnel                                                    */
  /* ------------------------------------------------------------------ */

  /** Favoris, du plus récent au plus ancien, limités aux pistes encore accessibles. */
  app.get("/api/me/favorites", auth, async (req, res, next) => {
    try {
      const favorites = await Reaction.find({ userId: req.auth.sub, type: "favorite" }).sort({ createdAt: -1 }).limit(200).lean();
      const docs = await publicTracks(favorites.map((item) => item.trackId), await readableMatch(req.auth.sub));
      console.log(`[library] ${docs.length} favori(s) accessibles envoyés à ${req.auth.sub}`);
      res.json({ docs });
    } catch (error) {
      console.error("[library] Erreur de lecture des favoris", error);
      next(error);
    }
  });

  /** Pistes que d'autres personnes ont partagées avec moi (accès encore actifs). */
  app.get("/api/me/shared", auth, async (req, res, next) => {
    try {
      const grants = await TrackAccess.find({ userId: req.auth.sub, revokedAt: null }).sort({ grantedAt: -1 }).limit(200).lean();
      const tracks = await publicTracks(grants.map((grant) => grant.trackId));
      const viaById = new Map(grants.map((grant) => [String(grant.trackId), grant]));
      const docs = tracks.map((track) => ({ ...track, sharedVia: viaById.get(track.id).via, sharedAt: viaById.get(track.id).grantedAt }));
      console.log(`[library] ${docs.length} piste(s) partagée(s) avec ${req.auth.sub}`);
      res.json({ docs });
    } catch (error) {
      console.error("[library] Erreur de lecture des partages reçus", error);
      next(error);
    }
  });

  /** Mes albums : regroupement de mes pistes par nom d'album. */
  app.get("/api/me/albums", auth, async (req, res, next) => {
    try {
      const albums = await Track.aggregate([
        { $match: { ownerId: oid(req.auth.sub), album: { $nin: [null, ""] } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$album",
            count: { $sum: 1 },
            trackIds: { $push: { $toString: "$_id" } },
            publicCount: { $sum: { $cond: [{ $eq: ["$visibility", "public"] }, 1, 0] } },
            coverId: { $first: { $cond: [{ $ifNull: ["$coverStoredName", false] }, "$_id", null] } },
            updatedAt: { $max: "$createdAt" },
          },
        },
        { $sort: { updatedAt: -1 } },
        { $project: { _id: 0, title: "$_id", count: 1, publicCount: 1, trackIds: 1, updatedAt: 1, coverUrl: { $cond: ["$coverId", { $concat: ["/api/tracks/", { $toString: "$coverId" }, "/cover"] }, null] } } },
      ]);
      res.json({ albums });
    } catch (error) {
      console.error("[library] Erreur de lecture des albums", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Accès individuels (section 5)                                       */
  /* ------------------------------------------------------------------ */

  /** Qui a accès à ma piste ? (propriétaire seulement) */
  app.get("/api/tracks/:id/access", auth, async (req, res, next) => {
    try {
      const track = await ownedTrack(req, res);
      if (!track) return;
      res.json(await accessList(track));
    } catch (error) {
      console.error("[access] Erreur de lecture des accès", error);
      next(error);
    }
  });

  /**
   * Donne accès à des personnes choisies PARMI SES AMIS (section 6). Une piste
   * privée passe automatiquement en « Amis choisis ». Un accès retiré auparavant
   * est réactivé. Chaque personne reçoit une notification.
   */
  app.post("/api/tracks/:id/access", auth, async (req, res, next) => {
    try {
      const track = await ownedTrack(req, res);
      if (!track) return;
      const raw = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
      const userIds = [...new Set(raw.map(String))];
      if (!userIds.length || userIds.length > 50 || !userIds.every(validId)) {
        return res.status(400).json({ message: "userIds doit contenir entre 1 et 50 identifiants valides" });
      }
      if (userIds.includes(String(req.auth.sub))) return res.status(400).json({ message: "Vous avez déjà accès à vos propres pistes" });
      const found = await User.countDocuments({ _id: { $in: userIds } });
      if (found !== userIds.length) return res.status(404).json({ message: "Utilisateur inconnu" });
      const friends = new Set(await friendIds(req.auth.sub));
      if (!userIds.every((userId) => friends.has(userId))) {
        return res.status(403).json({ message: "« Amis choisis » : vous ne pouvez partager qu'avec vos amis" });
      }
      const alreadyActive = new Set((await TrackAccess.find({ trackId: track._id, userId: { $in: userIds }, revokedAt: null }).lean()).map((grant) => String(grant.userId)));

      await TrackAccess.bulkWrite(
        userIds.map((userId) => ({
          updateOne: {
            filter: { trackId: track._id, userId: oid(userId) },
            update: { $set: { ownerId: track.ownerId, via: "share", grantedAt: new Date(), revokedAt: null } },
            upsert: true,
          },
        })),
      );
      if (track.visibility === "private") {
        track.visibility = "friends";
        await track.save();
      }
      for (const userId of userIds.filter((id) => !alreadyActive.has(id))) {
        await notify({ userId, type: "track_shared", actorId: req.auth.sub, trackId: track._id });
      }
      console.log(`[access] ${userIds.length} accès donné(s) sur ${track.id} par ${req.auth.sub}`);
      res.status(201).json(await accessList(track));
    } catch (error) {
      console.error("[access] Erreur d'ajout d'accès", error);
      next(error);
    }
  });

  /** Retire l'accès d'une personne. La trace est conservée (date de retrait). */
  app.delete("/api/tracks/:id/access/:userId", auth, async (req, res, next) => {
    try {
      const track = await ownedTrack(req, res);
      if (!track) return;
      if (!validId(req.params.userId)) return notFound(res, "Accès inconnu");
      const grant = await TrackAccess.findOneAndUpdate(
        { trackId: track._id, userId: req.params.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { new: true },
      );
      if (!grant) return notFound(res, "Accès inconnu ou déjà retiré");
      console.log(`[access] Accès retiré sur ${track.id} pour ${req.params.userId}`);
      res.json({ ...(await accessList(track)), notice: REVOKE_NOTICE });
    } catch (error) {
      console.error("[access] Erreur de retrait d'accès", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Playlists                                                           */
  /* ------------------------------------------------------------------ */

  function playlistFields(body, { partial }) {
    const fields = {};
    const errors = [];
    if (body?.name !== undefined || !partial) {
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) errors.push("Le nom doit faire entre 1 et 80 caractères");
      else fields.name = name;
    }
    if (body?.description !== undefined) {
      const description = String(body.description).trim();
      if (description.length > 300) errors.push("La description ne peut pas dépasser 300 caractères");
      else fields.description = description;
    }
    if (body?.visibility !== undefined) {
      if (!["private", "public"].includes(body.visibility)) errors.push("Visibilité d'une playlist : private ou public");
      else fields.visibility = body.visibility;
    }
    return { fields, errors };
  }

  async function ownedPlaylist(req, res) {
    if (!validId(req.params.id)) return notFound(res, "Playlist inconnue") && null;
    const playlist = await Playlist.findOne({ _id: req.params.id, ownerId: req.auth.sub });
    if (!playlist) return notFound(res, "Playlist inconnue") && null;
    return playlist;
  }

  /** Mes playlists. */
  app.get("/api/playlists", auth, async (req, res, next) => {
    try {
      const playlists = await Playlist.find({ ownerId: req.auth.sub }).sort({ updatedAt: -1 });
      res.json({ playlists: playlists.map((playlist) => playlist.toPublic()) });
    } catch (error) {
      console.error("[playlists] Erreur de lecture", error);
      next(error);
    }
  });

  /** Crée une playlist (privée par défaut). */
  app.post("/api/playlists", auth, async (req, res, next) => {
    try {
      const { fields, errors } = playlistFields(req.body, { partial: false });
      if (errors.length) return res.status(400).json({ message: errors.join(". ") });
      if ((await Playlist.countDocuments({ ownerId: req.auth.sub })) >= 100) return res.status(400).json({ message: "100 playlists au maximum" });
      const playlist = await Playlist.create({ ...fields, ownerId: req.auth.sub });
      console.log(`[playlists] Playlist créée : ${playlist.id}`);
      res.status(201).json(playlist.toPublic());
    } catch (error) {
      console.error("[playlists] Erreur de création", error);
      next(error);
    }
  });

  /**
   * Détail d'une playlist : la mienne, ou une playlist publique d'un autre.
   * Seules les pistes que le LECTEUR a le droit d'écouter sont renvoyées.
   */
  app.get("/api/playlists/:id", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return notFound(res, "Playlist inconnue");
      const playlist = await Playlist.findById(req.params.id);
      const mine = playlist && String(playlist.ownerId) === String(req.auth.sub);
      if (!playlist || (!mine && playlist.visibility !== "public")) return notFound(res, "Playlist inconnue");
      const tracks = await publicTracks(playlist.trackIds, await readableMatch(req.auth.sub));
      res.json({ ...playlist.toPublic(), tracks, hiddenCount: playlist.trackIds.length - tracks.length });
    } catch (error) {
      console.error("[playlists] Erreur de lecture d'une playlist", error);
      next(error);
    }
  });

  /** Modifie le nom, la description ou la visibilité. */
  app.patch("/api/playlists/:id", auth, async (req, res, next) => {
    try {
      const { fields, errors } = playlistFields(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors.join(". ") });
      if (!Object.keys(fields).length) return res.status(400).json({ message: "Aucun champ à modifier" });
      const playlist = await ownedPlaylist(req, res);
      if (!playlist) return;
      Object.assign(playlist, fields);
      await playlist.save();
      res.json(playlist.toPublic());
    } catch (error) {
      console.error("[playlists] Erreur de modification", error);
      next(error);
    }
  });

  /** Supprime une playlist (les pistes elles-mêmes ne sont pas touchées). */
  app.delete("/api/playlists/:id", auth, async (req, res, next) => {
    try {
      const playlist = await ownedPlaylist(req, res);
      if (!playlist) return;
      await playlist.deleteOne();
      console.log(`[playlists] Playlist supprimée : ${playlist.id}`);
      res.status(204).end();
    } catch (error) {
      console.error("[playlists] Erreur de suppression", error);
      next(error);
    }
  });

  /** Ajoute une piste que j'ai le droit d'écouter (sans doublon). */
  app.post("/api/playlists/:id/tracks", auth, async (req, res, next) => {
    try {
      const playlist = await ownedPlaylist(req, res);
      if (!playlist) return;
      const trackId = req.body?.trackId;
      if (!validId(trackId)) return res.status(400).json({ message: "trackId invalide" });
      const track = await Track.findById(trackId);
      if (!track) return notFound(res);
      if ((await canRead(track, req.auth.sub)) !== "ok") return res.status(403).json({ message: "Vous n'avez pas accès à cette piste" });
      if (!playlist.trackIds.some((id) => String(id) === String(track._id))) {
        playlist.trackIds.push(track._id);
        await playlist.save();
      }
      res.json(playlist.toPublic());
    } catch (error) {
      console.error("[playlists] Erreur d'ajout de piste", error);
      next(error);
    }
  });

  /** Retire une piste d'une playlist. */
  app.delete("/api/playlists/:id/tracks/:trackId", auth, async (req, res, next) => {
    try {
      const playlist = await ownedPlaylist(req, res);
      if (!playlist) return;
      playlist.trackIds = playlist.trackIds.filter((id) => String(id) !== String(req.params.trackId));
      await playlist.save();
      res.json(playlist.toPublic());
    } catch (error) {
      console.error("[playlists] Erreur de retrait de piste", error);
      next(error);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Morceaux en ligne (références)                                      */
  /* ------------------------------------------------------------------ */

  /** Mes morceaux en ligne, filtrables par style. */
  app.get("/api/external-tracks", auth, async (req, res, next) => {
    try {
      const match = { ownerId: req.auth.sub };
      if (typeof req.query.style === "string" && STYLES.includes(req.query.style)) match.style = req.query.style;
      const items = await ExternalTrack.find(match).sort({ createdAt: -1 }).limit(500);
      res.json({ docs: items.map((item) => item.toPublic()) });
    } catch (error) {
      console.error("[external] Erreur de lecture", error);
      next(error);
    }
  });

  /**
   * Enregistre un morceau en ligne, ou plusieurs avec { items: [...] } (utilisé
   * une seule fois pour reprendre ceux que l'ancienne version gardait dans le
   * navigateur). Un morceau déjà enregistré (même adresse) n'est pas dupliqué.
   */
  app.post("/api/external-tracks", auth, async (req, res, next) => {
    try {
      const batch = Array.isArray(req.body?.items);
      const items = batch ? req.body.items : [req.body];
      if (!items.length || items.length > 200) return res.status(400).json({ message: "Entre 1 et 200 morceaux par envoi" });
      const results = [];
      const rejected = [];
      for (const [index, item] of items.entries()) {
        const { fields, errors } = externalFields(item);
        if (errors.length) {
          if (!batch) return res.status(400).json({ message: errors.join(". ") });
          rejected.push({ index, message: errors.join(". ") });
          continue;
        }
        const doc = await ExternalTrack.findOneAndUpdate(
          { ownerId: req.auth.sub, audioUrl: fields.audioUrl },
          { $setOnInsert: { ...fields, ownerId: req.auth.sub } },
          { upsert: true, new: true, runValidators: true },
        );
        results.push(doc.toPublic());
      }
      console.log(`[external] ${results.length} morceau(x) en ligne enregistré(s), ${rejected.length} refusé(s), par ${req.auth.sub}`);
      res.status(201).json(batch ? { docs: results, rejected } : results[0]);
    } catch (error) {
      console.error("[external] Erreur d'enregistrement", error);
      next(error);
    }
  });

  /** Supprime un morceau en ligne (la référence seulement). */
  app.delete("/api/external-tracks/:id", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return notFound(res, "Morceau inconnu");
      const deleted = await ExternalTrack.findOneAndDelete({ _id: req.params.id, ownerId: req.auth.sub });
      if (!deleted) return notFound(res, "Morceau inconnu");
      res.status(204).end();
    } catch (error) {
      console.error("[external] Erreur de suppression", error);
      next(error);
    }
  });
}
