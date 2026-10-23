/**
 * Routes MOST VIBE de la section 8 : mixages et remixes.
 * - projets de mixage (brouillons enregistrés en base, repris plus tard) ;
 * - publication d'un mixage (piste « mix ») avec la visibilité choisie ;
 * - demandes d'autorisation de remix (demander, accepter, refuser, annuler) ;
 * - crédits « Remix par… » / « À partir de la création de… » calculés et figés
 *   par le serveur : aucune route ne permet ensuite de les modifier.
 *
 * Limite assumée : le serveur ne peut pas « écouter » l'enregistrement. Les
 * sources créditées sont celles que le studio a déclarées (pistes chargées sur
 * les platines), vérifiées une à une : existence, droit d'écoute, autorisation.
 */
import mongoose from "mongoose";
import { canRead } from "../access.js";
import { STYLES, VISIBILITIES } from "../constants.js";
import { ExternalTrack } from "../models/ExternalTrack.js";
import { MixProject } from "../models/MixProject.js";
import { RemixRequest } from "../models/RemixRequest.js";
import { Track } from "../models/Track.js";
import { User } from "../models/User.js";
import { isBlockedBetween, notify } from "../social.js";

const oid = (value) => new mongoose.Types.ObjectId(String(value));
const validId = (value) => mongoose.isValidObjectId(value) && String(value).length === 24;
const MAX_SOURCES = 50;

/** Une licence « ND » (No Derivatives, pas d'œuvre dérivée) interdit de publier un mixage. */
const forbidsDerivatives = (license) => /(^|[^a-z])nd([^a-z]|$)|no ?deriv|pas de modification/i.test(String(license ?? ""));

const num = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Nettoie l'état d'une platine envoyé par le studio (valeurs bornées, champs connus seulement). */
function cleanDeck(raw) {
  if (!raw || typeof raw !== "object") return null;
  const source = raw.source ?? {};
  if (!["track", "external"].includes(source.kind) || !validId(source.id)) return null;
  const eq = raw.eq ?? {};
  const fx = raw.fx ?? {};
  return {
    source: { kind: source.kind, id: String(source.id) },
    title: String(raw.title ?? "").slice(0, 200),
    position: num(raw.position, 0, 86400, 0),
    pitch: num(raw.pitch, -100, 100, 0),
    pitchRange: num(raw.pitchRange, 1, 100, 8),
    eq: { high: num(eq.high, -100, 100, 0), mid: num(eq.mid, -100, 100, 0), low: num(eq.low, -100, 100, 0) },
    filter: num(raw.filter, -1, 1, 0),
    fx: { echo: num(fx.echo, 0, 1, 0), reverb: num(fx.reverb, 0, 1, 0), flanger: num(fx.flanger, 0, 1, 0) },
    volume: num(raw.volume, 0, 2, 0.8),
  };
}

function cleanState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  const decks = {};
  for (const id of ["A", "B"]) {
    const deck = cleanDeck(state.decks?.[id]);
    if (deck) decks[id] = deck;
  }
  return { crossfader: num(state.crossfader, -1, 1, 0), masterVolume: num(state.masterVolume, 0, 1, 0.9), decks };
}

/** Identifiants valides d'une liste (tableau JSON ou chaîne séparée par des virgules), sans doublon. */
function idList(value) {
  const list = Array.isArray(value) ? value : typeof value === "string" && value ? value.split(",") : [];
  return [...new Set(list.map((item) => String(item).trim()).filter(validId))].slice(0, MAX_SOURCES);
}

/** Toutes les sources d'un projet : celles des platines et celles déclarées pendant l'enregistrement. */
function projectSources(project) {
  const decks = Object.values(project.state?.decks ?? {});
  const tracks = new Set([...project.sourceTrackIds.map(String), ...decks.filter((deck) => deck.source.kind === "track").map((deck) => deck.source.id)]);
  const external = new Set([...project.externalIds.map(String), ...decks.filter((deck) => deck.source.kind === "external").map((deck) => deck.source.id)]);
  return { trackIds: [...tracks], externalIds: [...external] };
}

/**
 * État de chaque source pour l'utilisateur qui veut publier :
 * own (sa piste), accepted, pending, refused, none (pas encore demandé) ou
 * unavailable (supprimée ou plus accessible). `publishable` est vrai si tout est en ordre.
 */
async function sourcesReport(project, me) {
  const { trackIds, externalIds } = projectSources(project);
  const [tracks, requests, externals] = await Promise.all([
    Track.find({ _id: { $in: trackIds } }),
    RemixRequest.find({ trackId: { $in: trackIds }, requesterId: me }).lean(),
    ExternalTrack.find({ _id: { $in: externalIds }, ownerId: me }),
  ]);
  const owners = await User.find({ _id: { $in: tracks.map((track) => track.ownerId) } }).select("name").lean();
  const names = new Map(owners.map((user) => [String(user._id), user.name]));
  const byTrack = new Map(requests.map((request) => [String(request.trackId), request]));
  const sources = [];
  for (const id of trackIds) {
    const track = tracks.find((item) => item.id === id);
    if (!track || (await canRead(track, me)) !== "ok") {
      sources.push({ trackId: id, title: track?.title ?? "Piste indisponible", owner: null, status: "unavailable", requestId: null });
      continue;
    }
    const own = String(track.ownerId) === String(me);
    const request = byTrack.get(id);
    sources.push({
      trackId: id,
      title: track.title,
      owner: { id: String(track.ownerId), name: names.get(String(track.ownerId)) ?? "Compte supprimé" },
      status: own ? "own" : (request?.status ?? "none"),
      requestId: request ? String(request._id) : null,
    });
  }
  const external = externals.map((item) => ({ id: item.id, title: item.title, artist: item.artist, license: item.license, sourceLabel: item.sourceLabel, pageUrl: item.pageUrl, blocked: forbidsDerivatives(item.license) }));
  const missingExternal = externalIds.length - externals.length;
  const publishable = sources.every((source) => ["own", "accepted"].includes(source.status)) && external.every((item) => !item.blocked) && missingExternal === 0;
  return { sources, external, publishable, tracks, externals };
}

async function ownedProject(req, res) {
  if (!validId(req.params.id)) {
    res.status(404).json({ message: "Projet inconnu" });
    return null;
  }
  const project = await MixProject.findOne({ _id: req.params.id, ownerId: req.auth.sub });
  if (!project) res.status(404).json({ message: "Projet inconnu" });
  return project;
}

/** Vue d'une demande de remix pour le frontend. */
async function requestViews(requests) {
  const userIds = requests.flatMap((request) => [request.ownerId, request.requesterId]);
  const [users, tracks] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("name").lean(),
    Track.find({ _id: { $in: requests.map((request) => request.trackId) } }).select("title").lean(),
  ]);
  const names = new Map(users.map((user) => [String(user._id), user.name]));
  const titles = new Map(tracks.map((track) => [String(track._id), track.title]));
  return requests.map((request) => ({
    id: String(request._id),
    track: { id: String(request.trackId), title: titles.get(String(request.trackId)) ?? "Piste supprimée" },
    owner: { id: String(request.ownerId), name: names.get(String(request.ownerId)) ?? "Compte supprimé" },
    requester: { id: String(request.requesterId), name: names.get(String(request.requesterId)) ?? "Compte supprimé" },
    status: request.status,
    message: request.message,
    createdAt: request.createdAt,
    answeredAt: request.answeredAt,
  }));
}

export function registerMixRoutes(app, { auth, upload, cleanupUploadedFiles, maxCoverSize }) {
  /* ------------------------------------------------------------------ */
  /* Projets de mixage                                                   */
  /* ------------------------------------------------------------------ */

  /** Mes projets, du plus récemment modifié au plus ancien (sans l'état complet). */
  app.get("/api/mixes", auth, async (req, res, next) => {
    try {
      const projects = await MixProject.find({ ownerId: req.auth.sub }).sort({ updatedAt: -1 }).limit(200);
      res.json({
        projects: projects.map((project) => {
          const view = project.toPublic();
          const decks = Object.entries(project.state?.decks ?? {}).map(([deck, state]) => ({ deck, title: state.title }));
          delete view.state;
          return { ...view, decks };
        }),
      });
    } catch (error) {
      console.error("[mixes] Erreur de lecture des projets", error);
      next(error);
    }
  });

  /** Crée un brouillon : { title, state, sourceTrackIds?, externalIds? }. */
  app.post("/api/mixes", auth, async (req, res, next) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      if (!title || title.length > 120) return res.status(400).json({ message: "Le titre doit faire entre 1 et 120 caractères" });
      if ((await MixProject.countDocuments({ ownerId: req.auth.sub })) >= 200) return res.status(400).json({ message: "200 projets au maximum" });
      const project = await MixProject.create({
        ownerId: req.auth.sub,
        title,
        state: cleanState(req.body?.state),
        sourceTrackIds: idList(req.body?.sourceTrackIds),
        externalIds: idList(req.body?.externalIds),
      });
      console.log(`[mixes] Brouillon créé : ${project.id}`);
      res.status(201).json(project.toPublic());
    } catch (error) {
      console.error("[mixes] Erreur de création", error);
      next(error);
    }
  });

  /** Un projet complet (pour le reprendre dans le studio). */
  app.get("/api/mixes/:id", auth, async (req, res, next) => {
    try {
      const project = await ownedProject(req, res);
      if (!project) return;
      res.json(project.toPublic());
    } catch (error) {
      console.error("[mixes] Erreur de lecture d'un projet", error);
      next(error);
    }
  });

  /**
   * Met à jour un projet : titre et/ou état du studio. Les sources déclarées
   * s'AJOUTENT à celles déjà connues (une piste utilisée reste créditée).
   */
  app.put("/api/mixes/:id", auth, async (req, res, next) => {
    try {
      const project = await ownedProject(req, res);
      if (!project) return;
      if (req.body?.title !== undefined) {
        const title = String(req.body.title).trim();
        if (!title || title.length > 120) return res.status(400).json({ message: "Le titre doit faire entre 1 et 120 caractères" });
        project.title = title;
      }
      if (req.body?.state !== undefined) project.state = cleanState(req.body.state);
      const sources = new Set([...project.sourceTrackIds.map(String), ...idList(req.body?.sourceTrackIds)]);
      const externals = new Set([...project.externalIds.map(String), ...idList(req.body?.externalIds)]);
      project.sourceTrackIds = [...sources].slice(0, MAX_SOURCES).map(oid);
      project.externalIds = [...externals].slice(0, MAX_SOURCES).map(oid);
      project.markModified("state");
      await project.save();
      res.json(project.toPublic());
    } catch (error) {
      console.error("[mixes] Erreur de mise à jour", error);
      next(error);
    }
  });

  /** Supprime un projet (les mixages déjà publiés restent en ligne). */
  app.delete("/api/mixes/:id", auth, async (req, res, next) => {
    try {
      const project = await ownedProject(req, res);
      if (!project) return;
      await project.deleteOne();
      res.status(204).end();
    } catch (error) {
      console.error("[mixes] Erreur de suppression", error);
      next(error);
    }
  });

  /** Avant publication : crédits prévus et état des autorisations de chaque source. */
  app.get("/api/mixes/:id/check", auth, async (req, res, next) => {
    try {
      const project = await ownedProject(req, res);
      if (!project) return;
      const { sources, external, publishable } = await sourcesReport(project, req.auth.sub);
      res.json({ sources, external, publishable });
    } catch (error) {
      console.error("[mixes] Erreur de vérification", error);
      next(error);
    }
  });

  /**
   * Publie le mixage : multipart avec `audio` (l'enregistrement, obligatoire),
   * `cover` (facultative), `title`, `visibility`, `durationSeconds`.
   * Refusé (403) si une source appartient à quelqu'un d'autre sans autorisation
   * acceptée ; refusé (400) si un morceau en ligne interdit les œuvres dérivées.
   */
  app.post(
    "/api/mixes/:id/publish",
    auth,
    upload.fields([
      { name: "audio", maxCount: 1 },
      { name: "cover", maxCount: 1 },
    ]),
    async (req, res, next) => {
      const files = Object.values(req.files || {}).flat();
      const audioFile = req.files?.audio?.[0];
      const coverFile = req.files?.cover?.[0];
      const fail = async (status, body) => {
        await cleanupUploadedFiles(files, "publication refusée");
        return res.status(status).json(body);
      };
      try {
        const project = await ownedProject(req, res);
        if (!project) return cleanupUploadedFiles(files, "projet inconnu");
        if (!audioFile) return fail(400, { message: "Enregistrement du mix requis : enregistrez votre mix dans le studio avant de le publier" });
        if (coverFile && coverFile.size > maxCoverSize) return fail(400, { message: "La couverture ne peut pas dépasser 5 Mo." });

        const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : project.title;
        if (title.length > 120) return fail(400, { message: "Le titre doit faire entre 1 et 120 caractères" });
        const visibility = req.body?.visibility || "private";
        if (!VISIBILITIES.includes(visibility)) return fail(400, { message: `Visibilité inconnue : ${VISIBILITIES.join(", ")}` });
        const duration = Number(req.body?.durationSeconds);
        const style = req.body?.style || "electro";
        if (!STYLES.includes(style)) return fail(400, { message: `Style inconnu. Styles possibles : ${STYLES.join(", ")}` });

        const report = await sourcesReport(project, req.auth.sub);
        const missing = report.sources.filter((source) => !["own", "accepted"].includes(source.status));
        if (missing.length) {
          return fail(403, { message: "Autorisation de remix manquante pour une ou plusieurs pistes", missing });
        }
        const blocked = report.external.filter((item) => item.blocked);
        if (blocked.length) return fail(400, { message: `La licence de « ${blocked[0].title} » interdit les œuvres dérivées (ND) : retirez ce morceau du mix`, blocked });
        if (!report.publishable) return fail(400, { message: "Un morceau en ligne de ce projet n'existe plus dans votre liste" });

        const me = await User.findById(req.auth.sub).select("name").lean();
        const owners = new Map(report.sources.filter((source) => source.owner).map((source) => [source.trackId, source.owner]));
        const credits = {
          remixBy: { id: oid(req.auth.sub), name: me?.name ?? "Compte supprimé" },
          sources: report.tracks.map((track) => ({ trackId: track._id, title: track.title, ownerId: track.ownerId, ownerName: owners.get(track.id)?.name ?? "Compte supprimé" })),
          external: report.externals.map((item) => ({ title: item.title, artist: item.artist, license: item.license, sourceLabel: item.sourceLabel, pageUrl: item.pageUrl })),
        };
        const track = await Track.create({
          ownerId: req.auth.sub,
          title,
          originalName: audioFile.originalname,
          storedName: audioFile.filename,
          mimeType: audioFile.mimetype,
          size: audioFile.size,
          kind: "mix",
          style,
          visibility,
          durationSeconds: Number.isFinite(duration) && duration > 0 && duration <= 86400 ? Math.round(duration * 10) / 10 : null,
          credits,
          mixProjectId: project._id,
          ...(coverFile && { coverStoredName: coverFile.filename, coverMimeType: coverFile.mimetype }),
        });
        project.status = "published";
        project.publishedAt = new Date();
        project.publishedTrackIds.push(track._id);
        await project.save();
        console.log(`[mixes] Projet ${project.id} publié : piste ${track.id} (${visibility}, ${credits.sources.length} source(s))`);
        res.status(201).json(track.toPublic());
      } catch (error) {
        console.error("[mixes] Erreur de publication", error);
        await cleanupUploadedFiles(files, "échec de publication");
        next(error);
      }
    },
  );

  /* ------------------------------------------------------------------ */
  /* Demandes de remix                                                   */
  /* ------------------------------------------------------------------ */

  /** Où en est mon autorisation de remixer cette piste ? */
  app.get("/api/tracks/:id/remix-permission", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Piste inconnue" });
      const track = await Track.findById(req.params.id);
      if (!track) return res.status(404).json({ message: "Piste inconnue" });
      if ((await canRead(track, req.auth.sub)) !== "ok") return res.status(403).json({ message: "Vous n'avez pas accès à cette piste" });
      if (String(track.ownerId) === String(req.auth.sub)) return res.json({ status: "own", requestId: null });
      const request = await RemixRequest.findOne({ trackId: track._id, requesterId: req.auth.sub }).lean();
      res.json({ status: request?.status ?? "none", requestId: request ? String(request._id) : null, message: request?.message ?? "" });
    } catch (error) {
      console.error("[remix] Erreur de lecture d'une autorisation", error);
      next(error);
    }
  });

  /** Demande l'autorisation de remixer une piste que je peux écouter. */
  app.post("/api/tracks/:id/remix-requests", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      if (!validId(req.params.id)) return res.status(404).json({ message: "Piste inconnue" });
      const track = await Track.findById(req.params.id);
      if (!track) return res.status(404).json({ message: "Piste inconnue" });
      if ((await canRead(track, me)) !== "ok") return res.status(403).json({ message: "Vous n'avez pas accès à cette piste" });
      if (String(track.ownerId) === String(me)) return res.status(400).json({ message: "C'est votre propre piste : pas besoin d'autorisation" });
      if (await isBlockedBetween(me, track.ownerId)) return res.status(403).json({ message: "Impossible de contacter cet auteur" });
      const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 300) : "";
      const existing = await RemixRequest.findOne({ trackId: track._id, requesterId: me });
      if (existing?.status === "pending") return res.status(409).json({ message: "Demande déjà envoyée, en attente de réponse" });
      if (existing?.status === "accepted") return res.status(409).json({ message: "Vous avez déjà l'autorisation" });
      let request;
      if (existing) {
        existing.status = "pending";
        existing.message = message;
        existing.answeredAt = null;
        request = await existing.save();
      } else {
        request = await RemixRequest.create({ trackId: track._id, ownerId: track.ownerId, requesterId: me, message });
      }
      await notify({ userId: track.ownerId, type: "remix_request", actorId: me, trackId: track._id });
      console.log(`[remix] Demande ${request.id} : ${me} → piste ${track.id}`);
      res.status(201).json((await requestViews([request.toObject()]))[0]);
    } catch (error) {
      console.error("[remix] Erreur de demande", error);
      next(error);
    }
  });

  /** Demandes reçues (box=incoming, par défaut) ou envoyées (box=outgoing). */
  app.get("/api/remix-requests", auth, async (req, res, next) => {
    try {
      const filter = req.query.box === "outgoing" ? { requesterId: req.auth.sub } : { ownerId: req.auth.sub };
      const requests = await RemixRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ requests: await requestViews(requests) });
    } catch (error) {
      console.error("[remix] Erreur de lecture des demandes", error);
      next(error);
    }
  });

  for (const [action, status, type] of [["accept", "accepted", "remix_accepted"], ["refuse", "refused", "remix_refused"]]) {
    /** Le propriétaire de la piste accepte ou refuse une demande en attente. */
    app.post(`/api/remix-requests/:id/${action}`, auth, async (req, res, next) => {
      try {
        if (!validId(req.params.id)) return res.status(404).json({ message: "Demande inconnue" });
        const request = await RemixRequest.findOneAndUpdate(
          { _id: req.params.id, ownerId: req.auth.sub, status: "pending" },
          { $set: { status, answeredAt: new Date() } },
          { new: true },
        ).lean();
        if (!request) return res.status(404).json({ message: "Demande inconnue ou déjà traitée" });
        await notify({ userId: request.requesterId, type, actorId: req.auth.sub, trackId: request.trackId });
        console.log(`[remix] Demande ${request._id} : ${status}`);
        res.json((await requestViews([request]))[0]);
      } catch (error) {
        console.error(`[remix] Erreur (${action})`, error);
        next(error);
      }
    });
  }

  /** Le demandeur annule une demande encore en attente. */
  app.delete("/api/remix-requests/:id", auth, async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ message: "Demande inconnue" });
      const deleted = await RemixRequest.findOneAndDelete({ _id: req.params.id, requesterId: req.auth.sub, status: "pending" });
      if (!deleted) return res.status(404).json({ message: "Demande inconnue ou déjà traitée" });
      res.status(204).end();
    } catch (error) {
      console.error("[remix] Erreur d'annulation", error);
      next(error);
    }
  });
}
