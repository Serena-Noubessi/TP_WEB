/**
 * Routes publiques de MOST VIBE (accessibles sans compte) : accueil, explorer,
 * recherche et fiche d'une piste. Elles ne renvoient QUE des pistes publiques :
 * la condition { visibility: "public" } est posée par le serveur et ne dépend
 * jamais des paramètres envoyés par le navigateur.
 */
import mongoose from "mongoose";
import { canRead, literalRegex, PUBLIC_MATCH } from "../access.js";
import { STYLES } from "../constants.js";
import { Track } from "../models/Track.js";

const MAX_LIMIT = 24;

/**
 * Étapes communes : auteur (nom seulement, jamais l'email), nombre de « j'aime »
 * et champs publics. Exportées pour la bibliothèque (routes/library.js).
 */
export const AUTHOR_LOOKUP = [
  { $lookup: { from: "users", localField: "ownerId", foreignField: "_id", as: "author", pipeline: [{ $project: { name: 1 } }] } },
  { $set: { author: { $first: "$author" } } },
  { $lookup: { from: "reactions", localField: "_id", foreignField: "trackId", as: "likes", pipeline: [{ $match: { type: "like" } }, { $count: "n" }] } },
];
export const PUBLIC_FIELDS = {
  $project: {
    _id: 0,
    id: { $toString: "$_id" },
    title: 1,
    style: 1,
    kind: 1,
    album: 1,
    tags: 1,
    mimeType: 1,
    visibility: 1,
    createdAt: 1,
    likeCount: { $ifNull: [{ $first: "$likes.n" }, 0] },
    durationSeconds: { $ifNull: ["$durationSeconds", null] },
    credits: { $ifNull: ["$credits", null] },
    author: { id: { $toString: "$author._id" }, name: "$author.name" },
    coverUrl: { $cond: [{ $ifNull: ["$coverStoredName", false] }, { $concat: ["/api/tracks/", { $toString: "$_id" }, "/cover"] }, null] },
  },
};

function pageParams(query, defaultLimit) {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(query.limit)) || defaultLimit));
  return { page, limit };
}

/** Texte de filtre limité à 100 caractères, ou chaîne vide. */
const text = (value) => (typeof value === "string" ? value.trim().slice(0, 100) : "");

export function registerPublicRoutes(app, { optionalAuth }) {
  /**
   * Accueil : ajouts récents, sélection, mixages de la communauté, albums et
   * nombre de pistes publiques par style.
   */
  app.get("/api/public/home", optionalAuth, async (req, res, next) => {
    try {
      console.log(`[public] Accueil demandé (${req.auth ? `utilisateur ${req.auth.sub}` : "visiteur"})`);
      const [recent, selection, mixes, albums, styles] = await Promise.all([
        Track.aggregate([{ $match: { ...PUBLIC_MATCH, kind: "track" } }, { $sort: { createdAt: -1 } }, { $limit: 12 }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]),
        Track.aggregate([{ $match: PUBLIC_MATCH }, { $sample: { size: 8 } }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]),
        Track.aggregate([{ $match: { ...PUBLIC_MATCH, kind: "mix" } }, { $sort: { createdAt: -1 } }, { $limit: 8 }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]),
        Track.aggregate([
          { $match: { ...PUBLIC_MATCH, album: { $nin: [null, ""] } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: { ownerId: "$ownerId", album: "$album" }, count: { $sum: 1 }, coverId: { $first: { $cond: [{ $ifNull: ["$coverStoredName", false] }, "$_id", null] } }, updatedAt: { $max: "$createdAt" } } },
          { $sort: { updatedAt: -1 } },
          { $limit: 8 },
          { $lookup: { from: "users", localField: "_id.ownerId", foreignField: "_id", as: "author", pipeline: [{ $project: { name: 1 } }] } },
          { $project: { _id: 0, title: "$_id.album", count: 1, author: { $first: "$author.name" }, coverUrl: { $cond: ["$coverId", { $concat: ["/api/tracks/", { $toString: "$coverId" }, "/cover"] }, null] } } },
        ]),
        Track.aggregate([{ $match: PUBLIC_MATCH }, { $group: { _id: "$style", count: { $sum: 1 } } }]),
      ]);
      const styleCounts = Object.fromEntries(STYLES.map((style) => [style, styles.find((item) => item._id === style)?.count ?? 0]));
      res.json({ recent, selection, mixes, albums, styles: styleCounts });
    } catch (error) {
      console.error("[public] Erreur de l'accueil", error);
      next(error);
    }
  });

  /**
   * Explorer / rechercher : texte libre (titre, auteur, album, tags) et filtres
   * style, auteur, album, tag ; tri récent ou titre ; pagination.
   */
  app.get("/api/public/tracks", optionalAuth, async (req, res, next) => {
    try {
      const { page, limit } = pageParams(req.query, 12);
      const q = text(req.query.q);
      const author = text(req.query.author);
      const album = text(req.query.album);
      const tag = text(req.query.tag).toLowerCase();
      const style = text(req.query.style);
      const kind = text(req.query.kind);
      if (style && !STYLES.includes(style)) return res.status(400).json({ message: `Style inconnu. Styles possibles : ${STYLES.join(", ")}` });
      if (kind && !["track", "mix"].includes(kind)) return res.status(400).json({ message: "Type inconnu : track ou mix" });
      const sort = req.query.sort === "title" ? { title: 1 } : { createdAt: -1 };

      const match = { ...PUBLIC_MATCH };
      if (style) match.style = style;
      if (kind) match.kind = kind;
      if (album) match.album = literalRegex(album);
      if (tag) match.tags = tag;
      const afterLookup = {};
      if (author) afterLookup["author.name"] = literalRegex(author);
      if (q) {
        const regex = literalRegex(q);
        afterLookup.$or = [{ title: regex }, { "author.name": regex }, { album: regex }, { tags: regex }];
      }

      console.log(`[public] Recherche page=${page} limit=${limit} q=${Boolean(q)} style=${style || "-"} (${req.auth ? "connecté" : "visiteur"})`);
      const aggregate = Track.aggregate([{ $match: match }, ...AUTHOR_LOOKUP, { $match: afterLookup }, { $sort: sort }, PUBLIC_FIELDS]);
      // useFacet: false — sinon la bibliothèque de pagination déplace les $match au début
      // du pipeline, avant la jointure qui ajoute le nom de l'auteur (filtre auteur toujours vide).
      const result = await Track.aggregatePaginate(aggregate, { page, limit, useFacet: false });
      console.log(`[public] ${result.docs.length} résultat(s) sur ${result.totalDocs}`);
      res.json(result);
    } catch (error) {
      console.error("[public] Erreur de recherche", error);
      next(error);
    }
  });

  /** Fiche d'une piste : publique, appartenant à l'utilisateur connecté, ou partagée avec lui. */
  app.get("/api/public/tracks/:id", optionalAuth, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Piste inconnue" });
      const [track] = await Track.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } }, ...AUTHOR_LOOKUP, { $set: { ownerId: "$ownerId" } }, { $project: { storedName: 0, legacyTitle: 0, legacyCategory: 0 } }]);
      if (!track) return res.status(404).json({ message: "Piste inconnue" });
      const access = await canRead(track, req.auth?.sub);
      if (access !== "ok") {
        console.warn(`[public] Fiche refusée (${access}) : ${req.params.id}`);
        return res.status(access === "login" ? 401 : 403).json({ message: access === "login" ? "Connexion requise pour voir cette piste" : "Vous n'avez pas accès à cette piste" });
      }
      const [publicTrack] = await Track.aggregate([{ $match: { _id: track._id } }, ...AUTHOR_LOOKUP, PUBLIC_FIELDS]);
      res.json(publicTrack);
    } catch (error) {
      console.error("[public] Erreur de lecture d'une fiche", error);
      next(error);
    }
  });
}
