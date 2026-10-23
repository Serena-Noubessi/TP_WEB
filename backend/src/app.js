import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { User } from "./models/User.js";
import { Track } from "./models/Track.js";
import { canRead } from "./access.js";
import { isRevoked } from "./sessions.js";
import { TrackAccess } from "./models/TrackAccess.js";
import { purgeTrack, UPLOADS } from "./track-cleanup.js";
import { STYLES, VISIBILITIES } from "./constants.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerSocialRoutes } from "./routes/social.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerMixRoutes } from "./routes/mixes.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerAdminRoutes } from "./routes/admin.js";

// Les fichiers audio et les couvertures restent sur le disque du serveur.
// MongoDB ne conserve que leurs métadonnées et noms de stockage internes.
// (Chemin défini dans track-cleanup.js, partagé avec la suppression des pistes.)

try {
  // mkdirSync est utilisé au démarrage : l'application doit disposer de ce
  // dossier avant de pouvoir accepter le premier upload.
  fs.mkdirSync(UPLOADS, { recursive: true });
  console.log(`[startup] Dossier des uploads prêt : ${UPLOADS}`);
} catch (error) {
  console.error("[startup] Impossible de créer le dossier des uploads", error);
  throw error;
}

// Ce secret reste côté serveur. Il ne doit jamais être copié dans Angular.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";

// La taille maximale d'un fichier audio est de 25 Mo. Les fichiers plus gros
// sont refusés par Multer avant d'être écrits sur le disque.
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024;

// Les types MIME autorisés correspondent aux formats demandés dans le sujet.
const allowed = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  // MOST VIBE étape 4 : format de l'enregistrement du studio de mixage (MediaRecorder).
  "audio/webm",
]);
/**
 * Fichiers MPEG annoncés autrement que « audio/mpeg » (Windows donne « video/mpeg »
 * aux fichiers .mpeg et .mpg). Ils sont acceptés et enregistrés comme « audio/mpeg »,
 * pour que les navigateurs les lisent comme du son. Le site vérifie avant l'envoi
 * que le son est lisible ; le serveur, lui, ne peut pas analyser le contenu.
 */
const MPEG_VARIANTS = new Set(["video/mpeg", "audio/mpg", "audio/x-mpeg", "audio/mp3", "audio/x-mp3", "audio/mpeg3", "audio/x-mpeg-3", "audio/mpga"]);
const audioMimeType = (mimetype) => (MPEG_VARIANTS.has(mimetype) ? "audio/mpeg" : mimetype);
const allowedCovers = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Crée un jeton JWT contenant uniquement l'identité nécessaire à l'API.
 * Le mot de passe n'est jamais placé dans le token. `sub` signifie subject
 * et contient l'identifiant MongoDB de l'utilisateur.
 */
function token(user) {
  console.log(`[auth] Création d'un token pour l'utilisateur ${user.id}`);
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, {
    expiresIn: "2h",
  });
}

/** Middleware Express qui protège les routes privées. */
function auth(req, res, next) {
  const raw = req.headers.authorization;

  // Le token est transmis dans l'en-tête Authorization sous la forme
    // "Authorization: Bearer <token>". Le préfixe "Bearer " est obligatoire pour que
    // le middleware sache qu'il s'agit d'un JWT et non d'un autre type de jeton.
  if (!raw?.startsWith("Bearer ")) {
    console.warn(`[auth] Authorization absente pour ${req.method} ${req.path}`);
    return res.status(401).json({ message: "Authentification requise" });
  }

  try {
    // jwt.verify vérifie la signature et la date d'expiration du token.
    // On ne logue jamais sa valeur, car un JWT permettrait une usurpation.
    req.auth = jwt.verify(raw.slice(7), SECRET);
    if (isRevoked(req.auth.sub)) {
      console.warn(`[auth] Jeton refusé : compte suspendu ou supprimé (${req.auth.sub})`);
      return res.status(401).json({ message: "Ce compte est suspendu ou n'existe plus" });
    }
    console.log(`[auth] Token accepté pour ${req.auth.sub}`);
    next();
  } catch (error) {
    console.error("[auth] Token invalide ou expiré", error);
    return res.status(401).json({ message: "Jeton invalide ou expiré" });
  }
}

/**
 * Authentification facultative (routes publiques et fichiers) : un visiteur sans
 * jeton est accepté comme anonyme. Un jeton invalide ou expiré est ignoré (le
 * visiteur reste anonyme et peut toujours écouter les contenus publics) et l'on
 * journalise l'avertissement.
 */
function optionalAuth(req, _res, next) {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) return next();
  try {
    req.auth = jwt.verify(raw.slice(7), SECRET);
    if (isRevoked(req.auth.sub)) delete req.auth;
  } catch (error) {
    console.warn(`[auth] Jeton facultatif ignoré pour ${req.method} ${req.path} : ${error.name}`);
  }
  next();
}

/** Lit et valide les champs MOST VIBE envoyés à la création ou à la modification d'une piste. */
function trackFields(body, { partial }) {
  const fields = {};
  const errors = [];
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title || title.length > 120) errors.push("Le titre doit faire entre 1 et 120 caractères");
    else fields.title = title;
  }
  if (body.style !== undefined && body.style !== "") {
    if (!STYLES.includes(body.style)) errors.push(`Style inconnu. Styles possibles : ${STYLES.join(", ")}`);
    else fields.style = body.style;
  }
  if (body.visibility !== undefined && body.visibility !== "") {
    if (!VISIBILITIES.includes(body.visibility)) errors.push(`Visibilité inconnue : ${VISIBILITIES.join(", ")}`);
    else fields.visibility = body.visibility;
  }
  if (body.tags !== undefined) {
    const list = Array.isArray(body.tags) ? body.tags : String(body.tags).split(",");
    const tags = [...new Set(list.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
    if (tags.length > 10 || tags.some((tag) => tag.length > 30)) errors.push("10 tags au maximum, de 30 caractères chacun");
    else fields.tags = tags;
  }
  if (body.album !== undefined) {
    const album = String(body.album).trim();
    if (album.length > 80) errors.push("Le nom d'album ne peut pas dépasser 80 caractères");
    else fields.album = album || null;
  }
  if (body.durationSeconds !== undefined && body.durationSeconds !== "") {
    const duration = Number(body.durationSeconds);
    if (!Number.isFinite(duration) || duration < 0 || duration > 86400) errors.push("Durée invalide (en secondes, 24 h au maximum)");
    else fields.durationSeconds = Math.round(duration * 10) / 10;
  }
  if (!partial && !fields.visibility) fields.visibility = "private";
  return { fields, errors };
}

/*
 * Multer transforme une requête HTTP multipart/form-data en données exploitables
 * par Express et traite les fichiers envoyés par un formulaire HTML.
 * Documentation officielle : https://github.com/expressjs/multer
 *
 * diskStorage indique que Multer écrit directement le fichier sur disque.
 * Chaque callback doit appeler cb(error, value) : null signifie qu'il n'y a
 * pas d'erreur. Le nom aléatoire évite les collisions entre utilisateurs.
 */
const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    console.debug(`[multer] Destination sélectionnée : ${UPLOADS}`);
    callback(null, UPLOADS);
  },
  filename: (_request, file, callback) => {
    const filename =
      crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
    console.log(`[multer] Nom de stockage généré pour ${file.originalname}`);
    callback(null, filename);
  },
});

/*
 * limits.fileSize protège le serveur contre les fichiers trop volumineux.
 * fileFilter est appelé avant l'enregistrement : accepter le fichier appelle
 * callback(null, true), le refuser transmet une vraie Error à Express.
 */
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_request, file, callback) => {
    const accepted =
      file.fieldname === "audio"
        ? allowed.has(file.mimetype) || MPEG_VARIANTS.has(file.mimetype)
        : file.fieldname === "cover" && allowedCovers.has(file.mimetype);
    if (accepted) {
      console.log(`[multer] Type accepté pour ${file.fieldname} : ${file.mimetype}`);
      return callback(null, true);
    }

    const message =
      file.fieldname === "cover"
        ? "Format de couverture non accepté. Utilisez JPEG, PNG ou WebP."
        : "Format audio non accepté";
    const error = new Error(message);
    console.error(`[multer] Type refusé pour ${file.fieldname} : ${file.mimetype}`, error);
    return callback(error);
  },
});

async function cleanupUploadedFiles(files, context) {
  for (const file of files) {
    const uploadedPath = path.join(UPLOADS, file.filename);
    try {
      await fsPromises.unlink(uploadedPath);
      console.log(`[tracks] Fichier temporaire supprimé (${context}) : ${uploadedPath}`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(
          `[tracks] Impossible de supprimer le fichier temporaire ${uploadedPath}`,
          error,
        );
      }
    }
  }
}

/**
 * Construit l'application Express sans ouvrir de port.
 * Cette séparation permet au serveur réel et aux tests de créer la même
 * application. Le port est ouvert uniquement dans server.js.
 */
export function createApp() {
  const app = express();

  // Journaliser la fin de chaque requête permet de suivre méthode, URL,
  // statut et durée sans exposer les corps contenant des mots de passe.
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      console.log(
        `[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`,
      );
    });
    next();
  });

  // CORS est nécessaire pour que le frontend Angular puisse appeler l'API.
  // C'est-à-dire que le navigateur autorise les requêtes cross-origin depuis localhost:4200.
  // Dans un vrai projet, il est recommandé de limiter les origines autorisées.
  // En production, CORS_ORIGIN limite les sites autorisés (ex. « https://mostvibe.exemple.fr »,
  // plusieurs adresses séparées par des virgules). Sans cette variable (développement),
  // toutes les origines sont acceptées.
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  app.use(allowedOrigins.length ? cors({ origin: allowedOrigins }) : cors());

  // Express ne gère pas nativement le JSON : ce middleware transforme le corps JSON en objet JavaScript 
  // accessible via req.body.
  // Il est placé avant les routes pour que toutes les requêtes JSON soient traitées.
  app.use(express.json());

  /** Endpoint public utilisé pour vérifier que l'API répond. */
  app.get("/api/health", (_req, res) => {
    console.log("[health] Vérification de l'API");
    res.json({ status: "ok" });
  });

  /** Requête POST pour "insertion" de donnée.
   * Inscrit un utilisateur et renvoie un token avec ses données publiques. 
   * @param {Object} req - La requête HTTP.
   * @param {Object} res - La réponse HTTP.
   * @param {Function} next - La fonction de middleware suivante.
   */
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { name, email, password } = req.body || {};
      console.log(`[auth] Tentative d'inscription pour ${email || "email absent"}`);

      if (!name || !email || !password || password.length < 8) {
        console.warn("[auth] Inscription refusée : données invalides ou incomplètes");
        return res.status(400).json({
          message: "Nom, email et mot de passe de 8 caractères requis",
        });
      }

      // Vérifie si l'email est déjà utilisé avant de créer un nouvel utilisateur.
      if (await User.exists({ email: String(email).toLowerCase() })) {
        console.warn(`[auth] Email déjà utilisé : ${email}`);
        return res.status(409).json({ message: "Email déjà utilisé" });
      }

      // Crée l'utilisateur et le stocke dans MongoDB. Le mot de passe est haché
      // par le hook pre('validate') défini dans le schéma Mongoose.
      const user = await User.create({ name, email, password });
      console.log(`[auth] Utilisateur créé : ${user.id}`);
      res.status(201).json({ token: token(user), user: user.toPublic() });
    } catch (error) {
      console.error("[auth] Erreur pendant l'inscription", error);
      next(error);
    }
  });

  /** Vérifie les identifiants et ouvre une session JWT. */
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const email = String(req.body?.email || "").toLowerCase();
      console.log(`[auth] Tentative de connexion pour ${email || "email absent"}`);
      const user = await User.findOne({ email }).select("+passwordHash");

      if (!user || !(await user.verifyPassword(req.body?.password || ""))) {
        console.warn(`[auth] Identifiants incorrects pour ${email}`);
        return res.status(401).json({ message: "Identifiants incorrects" });
      }

      if (user.suspendedAt) {
        console.warn(`[auth] Connexion refusée, compte suspendu : ${user.id}`);
        return res.status(403).json({ message: "Ce compte est suspendu par l'administration" + (user.suspendedReason ? ` : ${user.suspendedReason}` : ".") });
      }
      console.log(`[auth] Connexion réussie : ${user.id}`);
      res.json({ token: token(user), user: user.toPublic() });
    } catch (error) {
      console.error("[auth] Erreur pendant la connexion", error);
      next(error);
    }
  });

  /** Retourne le profil public de l'utilisateur identifié par le JWT. */
  app.get("/api/users/me", auth, async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.sub);
      if (!user) {
        console.warn(`[user] Profil introuvable : ${req.auth.sub}`);
        return res.status(404).json({ message: "Utilisateur inconnu" });
      }

      console.log(`[user] Profil envoyé : ${user.id}`);
      res.json(user.toPublic());
    } catch (error) {
      console.error("[user] Erreur de lecture du profil", error);
      next(error);
    }
  });

  /** Modifie uniquement le nom de l'utilisateur connecté. */
  app.put("/api/users/me", auth, async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.auth.sub,
        { $set: { name: req.body?.name } },
        { new: true, runValidators: true },
      );

      if (!user) {
        console.warn(`[user] Mise à jour impossible : ${req.auth.sub}`);
        return res.status(404).json({ message: "Utilisateur inconnu" });
      }

      console.log(`[user] Nom mis à jour : ${user.id}`);
      res.json(user.toPublic());
    } catch (error) {
      console.error("[user] Erreur de mise à jour du profil", error);
      next(error);
    }
  });

  /** Retourne une page des pistes appartenant exclusivement à l'utilisateur. */
  app.get("/api/tracks", auth, async (req, res, next) => {
    try {
      const requestedPage = Number(req.query.page);
      const requestedLimit = Number(req.query.limit);
      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim().slice(0, 100)
          : "";
      const page = Number.isFinite(requestedPage)
        ? Math.max(1, Math.trunc(requestedPage))
        : 1;
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(20, Math.max(1, Math.trunc(requestedLimit)))
        : 5;

      console.log(
        `[tracks] Lecture page=${page}, limit=${limit}, search=${Boolean(search)}, user=${req.auth.sub}`,
      );

      const match = { ownerId: new mongoose.Types.ObjectId(req.auth.sub) };
      if (typeof req.query.style === "string" && req.query.style) {
        if (!STYLES.includes(req.query.style)) {
          return res.status(400).json({ message: `Style inconnu. Styles possibles : ${STYLES.join(", ")}` });
        }
        match.style = req.query.style;
      }
      if (search) {
        match.title = {
          $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        };
      }

      const aggregate = Track.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $project: { storedName: 0, legacyTitle: 0, legacyCategory: 0 } },
      ]);
       const result = await Track.aggregatePaginate(aggregate, { page, limit });
      const publicDocs = result.docs.map(({
        _id,
        storedName,
        coverStoredName,
        coverMimeType,
        ...track
      }) => ({
         ...track,
         id: String(_id),
         coverUrl: coverStoredName
           ? `/api/tracks/${String(_id)}/cover`
           : null,
       }));

       console.log(`[tracks] ${publicDocs.length} piste(s) envoyée(s) sur ${result.totalDocs}`);
       res.json({ ...result, docs: publicDocs });
    } catch (error) {
      console.error("[tracks] Erreur de pagination", error);
      next(error);
    }
  });

  /**
   * Reçoit les champs multipart audio, title et cover.
   * Multer place les fichiers dans req.files et le titre dans req.body.
   * C'est ici qu'est fait l'upload de fichiers sur le serveur. 
   * Le middleware auth vérifie le JWT avant d'accepter l'upload.
   * Le middleware upload.fields traite l'audio requis et la couverture optionnelle.
   * Si le fichier est accepté, il est stocké sur le disque et ses métadonnées sont enregistrées 
   * dans MongoDB.
   */
  app.post(
    "/api/tracks",
    auth,
    upload.fields([
      { name: "audio", maxCount: 1 },
      { name: "cover", maxCount: 1 },
    ]),
    async (req, res, next) => {
      const files = Object.values(req.files || {}).flat();
      const audioFile = req.files?.audio?.[0];
      const coverFile = req.files?.cover?.[0];
      try {
        if (!audioFile) {
          console.warn(`[tracks] Upload sans fichier par ${req.auth.sub}`);
          await cleanupUploadedFiles(files, "audio manquant");
          return res.status(400).json({ message: "Fichier audio requis" });
        }

        if (coverFile && coverFile.size > MAX_COVER_FILE_SIZE) {
          console.warn(`[tracks] Couverture trop volumineuse : ${coverFile.size} octets`);
          await cleanupUploadedFiles(files, "couverture trop volumineuse");
          return res.status(400).json({
            message: "La couverture ne peut pas dépasser 5 Mo.",
          });
        }

        const { fields, errors } = trackFields(req.body ?? {}, { partial: false });
        if (errors.length) {
          console.warn(`[tracks] Upload refusé : ${errors.join(" ; ")}`);
          await cleanupUploadedFiles(files, "champs invalides");
          return res.status(400).json({ message: errors.join(". ") });
        }

        const track = await Track.create({
          ...fields,
          ownerId: req.auth.sub,
          title: fields.title || audioFile.originalname,
          originalName: audioFile.originalname,
          storedName: audioFile.filename,
          mimeType: audioMimeType(audioFile.mimetype),
          size: audioFile.size,
          ...(coverFile && {
            coverStoredName: coverFile.filename,
            coverMimeType: coverFile.mimetype,
          }),
        });

        console.log(`[tracks] Upload enregistré : ${track.id}`);
        res.status(201).json(track.toPublic());
      } catch (error) {
        console.error("[tracks] Erreur après l'enregistrement du fichier", error);

        // Si MongoDB échoue après l'écriture sur disque, on tente de nettoyer
        // le fichier orphelin. L'erreur de nettoyage est elle aussi loguée.
        await cleanupUploadedFiles(files, "échec de création");
        next(error);
      }
    },
  );

  /**
   * Réponse commune quand l'accès à un fichier est refusé : 401 si le visiteur
   * doit se connecter, 403 s'il est connecté mais n'a pas le droit.
   */
  function denyFile(res, access, kind, id) {
    console.warn(`[tracks] ${kind} refusé (${access}) : ${id}`);
    return access === "login"
      ? res.status(401).json({ message: "Connexion requise pour écouter cette piste" })
      : res.status(403).json({ message: "Vous n'avez pas accès à cette piste" });
  }

  /** Envoie la couverture d'une piste si l'utilisateur y a accès (propriétaire, piste publique ou accès actif). */
  app.get("/api/tracks/:id/cover", optionalAuth, async (req, res, next) => {
    try {
      const track = await Track.findById(req.params.id).select("+coverStoredName +coverMimeType");

      if (!track?.coverStoredName) {
        console.warn(`[tracks] Couverture introuvable : ${req.params.id}`);
        return res.status(404).json({ message: "Couverture inconnue" });
      }
      const access = await canRead(track, req.auth?.sub);
      if (access !== "ok") return denyFile(res, access, "Couverture", track.id);

      const coverPath = path.join(UPLOADS, track.coverStoredName);
      res.type(track.coverMimeType);
      res.sendFile(coverPath, (error) => {
        if (error) {
          console.error(`[tracks] Erreur d'envoi de la couverture ${track.id}`, error);
          if (!res.headersSent) next(error);
          return;
        }
        console.log(`[tracks] Couverture envoyée : ${track.id}`);
      });
    } catch (error) {
      console.error("[tracks] Erreur de préparation de la couverture", error);
      next(error);
    }
  });

  /**
   * Envoie le contenu binaire d'une piste si l'utilisateur y a accès : les droits
   * sont vérifiés à chaque requête, y compris sur un lien direct. sendFile gère
   * l'en-tête Range (lecture partielle, déplacement dans le morceau).
   */
  app.get("/api/tracks/:id/audio", optionalAuth, async (req, res, next) => {
    try {
      const track = await Track.findById(req.params.id).select("+storedName");

      if (!track) {
        console.warn(`[tracks] Audio introuvable : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }
      const access = await canRead(track, req.auth?.sub);
      if (access !== "ok") return denyFile(res, access, "Audio", track.id);

      const audioPath = path.join(UPLOADS, track.storedName);
      res.type(track.mimeType);
      // Ce callback permet de loguer le succès ou l'erreur du transfert.
      res.sendFile(audioPath, (error) => {
        if (error) {
          console.error(`[tracks] Erreur d'envoi audio ${track.id}`, error);
          if (!res.headersSent) next(error);
          return;
        }
        console.log(`[tracks] Audio envoyé : ${track.id}`);
      });
    } catch (error) {
      console.error("[tracks] Erreur de préparation du flux audio", error);
      next(error);
    }
  });

  /** Modifie le titre, le style, la visibilité, les tags ou l'album d'une piste (propriétaire seulement). */
  app.patch("/api/tracks/:id", auth, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Piste inconnue" });
      const { fields, errors } = trackFields(req.body ?? {}, { partial: true });
      if (errors.length) return res.status(400).json({ message: errors.join(". ") });
      if (!Object.keys(fields).length) return res.status(400).json({ message: "Aucun champ à modifier" });

      const track = await Track.findOneAndUpdate({ _id: req.params.id, ownerId: req.auth.sub }, { $set: fields }, { new: true, runValidators: true });
      if (!track) {
        console.warn(`[tracks] Modification impossible (inconnue ou pas propriétaire) : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }
      // Repasser en « Privé » retire les accès « Amis choisis » (les pistes
      // envoyées dans un message restent accessibles à leur destinataire).
      let revoked = 0;
      if (fields.visibility === "private") {
        const result = await TrackAccess.updateMany({ trackId: track._id, via: "share", revokedAt: null }, { $set: { revokedAt: new Date() } });
        revoked = result.modifiedCount;
      }
      console.log(`[tracks] Piste modifiée : ${track.id} (${Object.keys(fields).join(", ")}), accès retirés : ${revoked}`);
      res.json({ ...track.toPublic(), revokedAccesses: revoked });
    } catch (error) {
      console.error("[tracks] Erreur de modification", error);
      next(error);
    }
  });

  registerPublicRoutes(app, { optionalAuth });
  registerLibraryRoutes(app, { auth, optionalAuth });
  registerSocialRoutes(app, { auth });
  registerMessageRoutes(app, { auth });
  registerMixRoutes(app, { auth, upload, cleanupUploadedFiles, maxCoverSize: MAX_COVER_FILE_SIZE });
  registerSettingsRoutes(app, { auth });
  registerAdminRoutes(app, { auth });

  /** Supprime la métadonnée et le fichier physique correspondant. */
  app.delete("/api/tracks/:id", auth, async (req, res, next) => {
    try {
      const track = await Track.findOneAndDelete({
        _id: req.params.id,
        ownerId: req.auth.sub,
      }).select("+storedName +coverStoredName");

      if (!track) {
        console.warn(`[tracks] Suppression impossible : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      // Réactions, accès, entrées de playlist, demandes de remix et fichiers disparaissent avec elle.
      const failedDeletes = await purgeTrack(track);
      if (failedDeletes.length) {
        return res.status(500).json({
          message: "Métadonnée supprimée, mais un ou plusieurs fichiers n'ont pas pu être supprimés",
        });
      }

      res.status(204).end();
    } catch (error) {
      console.error("[tracks] Erreur de suppression", error);
      next(error);
    }
  });

  /*
   * Mise en ligne (section 13) : si FRONTEND_DIST indique le dossier du site Angular
   * compilé (frontend-starter/dist/gpc/browser), ce serveur le sert aussi. Le site et
   * l'API ont alors la même adresse, et les appels relatifs « /api/... » d'Angular
   * fonctionnent sans proxy. Toute adresse inconnue hors /api renvoie index.html :
   * c'est Angular qui affiche la bonne page.
   */
  const frontendDist = process.env.FRONTEND_DIST ? path.resolve(process.env.FRONTEND_DIST) : null;
  if (frontendDist && fs.existsSync(path.join(frontendDist, "index.html"))) {
    console.log(`[startup] Site Angular servi depuis ${frontendDist}`);
    app.use(express.static(frontendDist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api(\/|$)).*/, (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
  } else if (frontendDist) {
    console.warn(`[startup] FRONTEND_DIST ignoré : ${frontendDist}/index.html introuvable (lancez « npx ng build »)`);
  }

  /** Gestionnaire central des erreurs connues de l'application. */
  app.use((error, _req, res, next) => {
    console.error("[error] Erreur reçue par le gestionnaire central", error);

    if (
      error instanceof multer.MulterError ||
      error?.message === "Format audio non accepté" ||
      error?.message?.startsWith("Format de couverture non accepté")
    ) {
      return res.status(400).json({ message: error.message });
    }
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.name === "CastError") {
      return res.status(404).json({ message: "Ressource inconnue" });
    }

    next(error);
  });

  return app;
}
