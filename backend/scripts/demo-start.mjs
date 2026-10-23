/**
 * Démarre l'API sur la base de DÉMONSTRATION (most-vibe-demo), port 3001 par défaut,
 * sans toucher à la vraie base ni au serveur habituel (port 3000).
 *
 *   npm run demo:start
 */
// Port forcé : le PORT de .env (3000) est celui du serveur habituel, déjà utilisé.
process.env.PORT = process.env.DEMO_PORT ?? "3001";
process.env.MONGODB_DB = "most-vibe-demo";
await import("../src/server.js");
