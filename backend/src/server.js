import mongoose from "mongoose";
import { createApp } from "./app.js";
import { User } from "./models/User.js";
import { loadSuspended } from "./sessions.js";

// Le port et l'URI viennent de l'environnement du backend, jamais d'Angular.
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

// Section 13 (mise en ligne) : en production, un vrai secret JWT est obligatoire.
// Sans lui, n'importe qui pourrait fabriquer des jetons avec le secret de développement.
if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32 || secret.startsWith("replace-with")) {
    const error = new Error("JWT_SECRET manquant ou trop court (32 caractères minimum) : démarrage refusé en production");
    console.error("[startup] Configuration de sécurité insuffisante", error);
    throw error;
  }
}

if (!uri) {
  const error = new Error("MONGODB_URI manque dans backend/.env");
  console.error("[startup] Configuration MongoDB absente", error);
  throw error;
}

try {
  // `await` suspend le démarrage jusqu'à la connexion effective à MongoDB.
  // Le `then` rend le succès visible dans les logs.
  // MONGODB_DB (facultatif) choisit une autre base que celle de l'URI : base de
  // démonstration ou de test, sans jamais toucher aux vraies données.
  const dbName = process.env.MONGODB_DB;
  await mongoose.connect(uri, dbName ? { dbName } : {}).then(() => {
    console.log("[startup] Connecté à MongoDB Atlas");
    console.log(
      `[startup] La base ${mongoose.connection.db.databaseName} est prête à recevoir des données`,
    );
    console.log(`[startup] Vérification : http://localhost:${port}/api/health`);
  });
  // Section 10 : les comptes suspendus sont refusés dès le démarrage.
  console.log(`[startup] Comptes suspendus chargés : ${await loadSuspended(User)}`);
} catch (error) {
  // Ne pas démarrer une API qui ne peut pas accéder à sa base de données.
  console.error("[startup] Échec de connexion à MongoDB", error);
  throw error;
}

try {
  // Le compte de démonstration facilite les premiers tests des étudiants.
  const demoEmail = "demo@example.com";
  const demoExists = await User.exists({ email: demoEmail });

  if (!demoExists) {
    const demoUser = await User.create({
      name: "Demo",
      email: demoEmail,
      password: "Demo1234!",
    });
    console.log(`[startup] Compte de démonstration créé : ${demoUser.id}`);
  } else {
    console.log("[startup] Compte de démonstration déjà présent");
  }
} catch (error) {
  console.error("[startup] Impossible de préparer le compte de démonstration", error);
  throw error;
}

const server = createApp().listen(port, () => {
  console.log(`Guitar Practice Cloud API: http://localhost:${port}/api/health`);
});

// Le callback `error` couvre notamment un port déjà utilisé.
server.on("error", (error) => {
  console.error(`[startup] Impossible d'écouter sur le port ${port}`, error);
});
