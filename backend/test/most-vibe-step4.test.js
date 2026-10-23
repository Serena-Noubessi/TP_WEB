/**
 * Tests d'intégration MOST VIBE (sections 8, 9 et 10) sur une base MongoDB
 * SÉPARÉE (« most-vibe-test-step4 »). Ignorés sans MONGODB_URI.
 *
 * Comptes : A (Alice) remixe une piste publique de B (Bob) ; C (Chloé) est un
 * autre membre ; M (Maud) est administratrice.
 */
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";
import { ExternalTrack } from "../src/models/ExternalTrack.js";

const TEST_DB = "most-vibe-test-step4";
const skip = !process.env.MONGODB_URI && "MONGODB_URI absent : tests d'intégration ignorés";
const secret = process.env.JWT_SECRET || "tp1-development-secret";
let server, base, A, B, C, M, tracks;
const storedFiles = [];

async function createTrack(owner, fields) {
  const storedName = `test-${new mongoose.Types.ObjectId()}.mp3`;
  await fsPromises.writeFile(path.join("data", "uploads", storedName), Buffer.from(`audio ${fields.title}`));
  storedFiles.push(storedName);
  return Track.create({ ownerId: owner._id, originalName: "a.mp3", storedName, mimeType: "audio/mpeg", size: 10, ...fields });
}

const token = (user) => jwt.sign({ sub: String(user._id) }, secret);
const call = async (method, url, user, body) => {
  const response = await fetch(base + url, {
    method,
    headers: { ...(user && { Authorization: `Bearer ${token(user)}` }), ...(body !== undefined && { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
};
/** Publication multipart d'un projet (faux enregistrement webm). */
const publish = async (projectId, user, fields = {}) => {
  const form = new FormData();
  form.append("audio", new Blob([Buffer.from("faux enregistrement webm")], { type: "audio/webm" }), "mon-mix.webm");
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const response = await fetch(`${base}/api/mixes/${projectId}/publish`, { method: "POST", headers: { Authorization: `Bearer ${token(user)}` }, body: form });
  return { status: response.status, body: await response.json() };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).status;
const deckState = (track) => ({ source: { kind: "track", id: String(track._id) }, title: track.title, position: 12.5, pitch: 3, eq: { high: 1, mid: 0, low: -2 }, fx: { echo: 0.2 }, volume: 0.9 });

test.describe("MOST VIBE — mixages, remixes, paramètres et administration", { skip }, () => {
  test.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
    assert.equal(mongoose.connection.db.databaseName, TEST_DB, "sécurité : jamais la vraie base");
    await mongoose.connection.db.dropDatabase();
    A = await User.create({ name: "Alice Vibe", email: "a@test.local", password: "motdepasse" });
    B = await User.create({ name: "Bob Beat", email: "b@test.local", password: "motdepasse" });
    C = await User.create({ name: "Chloé Groove", email: "c@test.local", password: "motdepasse" });
    M = await User.create({ name: "Maud Admin", email: "m@test.local", password: "motdepasse", role: "admin" });
    tracks = {
      aOwn: await createTrack(A, { title: "Boucle d'Alice", visibility: "private" }),
      bPublic: await createTrack(B, { title: "Basse de Bob", visibility: "public" }),
      bPrivate: await createTrack(B, { title: "Secret de Bob", visibility: "private" }),
    };
    server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    server?.close();
    for (const name of storedFiles) await fsPromises.unlink(path.join("data", "uploads", name)).catch(() => undefined);
    // Les fichiers des mixages publiés pendant le test.
    for (const track of await Track.find({ kind: "mix" }).select("+storedName").lean()) {
      await fsPromises.unlink(path.join("data", "uploads", track.storedName)).catch(() => undefined);
    }
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  let projectId;
  let mixId;

  test("brouillon de mixage : état nettoyé, repris, réservé à son auteur", async () => {
    assert.equal((await call("POST", "/api/mixes", A, { title: "" })).status, 400);
    const created = await call("POST", "/api/mixes", A, {
      title: "Mix du soir",
      state: { crossfader: 5, masterVolume: 0.7, decks: { A: deckState(tracks.aOwn), B: { ...deckState(tracks.bPublic), pirate: "x", volume: 99 }, C: deckState(tracks.aOwn) } },
    });
    assert.equal(created.status, 201);
    projectId = created.body.id;
    assert.equal(created.body.status, "draft");
    assert.equal(created.body.state.crossfader, 1, "valeur bornée");
    assert.equal(created.body.state.decks.B.volume, 2, "volume borné");
    assert.equal("pirate" in created.body.state.decks.B, false, "champ inconnu retiré");
    assert.equal("C" in created.body.state.decks, false, "seulement les platines A et B");

    const updated = await call("PUT", `/api/mixes/${projectId}`, A, { title: "Mix du soir v2", state: { decks: { A: deckState(tracks.aOwn) } }, sourceTrackIds: [String(tracks.bPublic._id)] });
    assert.deepEqual([updated.body.title, updated.body.sourceTrackIds], ["Mix du soir v2", [String(tracks.bPublic._id)]], "les sources utilisées s'ajoutent");
    const list = (await call("GET", "/api/mixes", A)).body.projects;
    assert.deepEqual(list.map((project) => [project.title, project.decks.length]), [["Mix du soir v2", 1]]);
    assert.equal((await call("GET", `/api/mixes/${projectId}`, C)).status, 404, "le projet d'Alice est invisible pour Chloé");
    assert.equal((await call("GET", `/api/mixes/${projectId}`, A)).body.state.decks.A.position, 12.5, "le brouillon se reprend");
  });

  test("remix : publication refusée sans l'accord de l'auteur, puis acceptée", async () => {
    let check = (await call("GET", `/api/mixes/${projectId}/check`, A)).body;
    assert.deepEqual(check.sources.map((source) => [source.title, source.status]).sort(), [["Basse de Bob", "none"], ["Boucle d'Alice", "own"]]);
    assert.equal(check.publishable, false);
    const refused = await publish(projectId, A, { title: "Mon remix", visibility: "public" });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.missing[0].title, "Basse de Bob");

    assert.equal((await call("POST", `/api/tracks/${tracks.bPrivate._id}/remix-requests`, A, {})).status, 403, "pas de demande sur une piste qu'on ne peut pas écouter");
    assert.equal((await call("POST", `/api/tracks/${tracks.aOwn._id}/remix-requests`, A, {})).status, 400, "pas de demande sur sa propre piste");
    const asked = await call("POST", `/api/tracks/${tracks.bPublic._id}/remix-requests`, A, { message: "Je peux ?" });
    assert.equal(asked.status, 201);
    assert.equal((await call("POST", `/api/tracks/${tracks.bPublic._id}/remix-requests`, A, {})).status, 409);
    assert.equal((await call("GET", "/api/notifications", B)).body.items[0].type, "remix_request");
    const incoming = (await call("GET", "/api/remix-requests", B)).body.requests;
    assert.deepEqual(incoming.map((request) => [request.requester.name, request.track.title, request.message]), [["Alice Vibe", "Basse de Bob", "Je peux ?"]]);
    assert.equal((await call("POST", `/api/remix-requests/${asked.body.id}/accept`, A)).status, 404, "seul l'auteur répond");
    assert.equal((await call("POST", `/api/remix-requests/${asked.body.id}/accept`, B)).status, 200);
    assert.equal((await call("GET", "/api/notifications", A)).body.items[0].type, "remix_accepted");
    assert.equal((await call("GET", `/api/tracks/${tracks.bPublic._id}/remix-permission`, A)).body.status, "accepted");

    check = (await call("GET", `/api/mixes/${projectId}/check`, A)).body;
    assert.equal(check.publishable, true);
    const published = await publish(projectId, A, { title: "Mon remix", visibility: "public", durationSeconds: "184.4" });
    assert.equal(published.status, 201);
    mixId = published.body.id;
    assert.deepEqual([published.body.kind, published.body.visibility, published.body.durationSeconds, published.body.mimeType], ["mix", "public", 184.4, "audio/webm"]);
    assert.equal(published.body.credits.remixBy.name, "Alice Vibe");
    assert.deepEqual(published.body.credits.sources.map((source) => [source.title, source.ownerName]).sort(), [["Basse de Bob", "Bob Beat"], ["Boucle d'Alice", "Alice Vibe"]]);
    assert.equal((await call("GET", `/api/mixes/${projectId}`, A)).body.status, "published");
  });

  test("crédits figés : impossibles à modifier, visibles publiquement", async () => {
    const patched = await call("PATCH", `/api/tracks/${mixId}`, A, { title: "Remix renommé", credits: { remixBy: { name: "Quelqu'un d'autre" }, sources: [] } });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.title, "Remix renommé");
    assert.equal(patched.body.credits.remixBy.name, "Alice Vibe", "le corps ne peut pas changer les crédits");
    assert.equal(patched.body.credits.sources.length, 2);
    const fiche = (await call("GET", `/api/public/tracks/${mixId}`)).body;
    assert.equal(fiche.credits.sources.find((source) => source.title === "Basse de Bob").ownerName, "Bob Beat");
  });

  test("refus puis nouvelle demande ; licence « ND » bloquante", async () => {
    const asked = await call("POST", `/api/tracks/${tracks.bPublic._id}/remix-requests`, C, {});
    await call("POST", `/api/remix-requests/${asked.body.id}/refuse`, B);
    assert.equal((await call("GET", `/api/tracks/${tracks.bPublic._id}/remix-permission`, C)).body.status, "refused");
    assert.equal((await call("GET", "/api/notifications", C)).body.items[0].type, "remix_refused");
    const again = await call("POST", `/api/tracks/${tracks.bPublic._id}/remix-requests`, C, { message: "Nouvelle version" });
    assert.deepEqual([again.status, again.body.status], [201, "pending"]);
    assert.equal((await call("DELETE", `/api/remix-requests/${again.body.id}`, C)).status, 204, "annulation par le demandeur");

    const nd = await ExternalTrack.create({ ownerId: A._id, title: "Morceau ND", audioUrl: "https://example.org/nd.mp3", sourceId: "jamendo", sourceLabel: "Jamendo", license: "CC BY-NC-ND 3.0" });
    const project = await call("POST", "/api/mixes", A, { title: "Avec un morceau ND", state: { decks: { A: { source: { kind: "external", id: nd.id }, title: "Morceau ND" } } } });
    const check = (await call("GET", `/api/mixes/${project.body.id}/check`, A)).body;
    assert.deepEqual([check.external[0].blocked, check.publishable], [true, false]);
    const refused = await publish(project.body.id, A);
    assert.equal(refused.status, 400);
    assert.match(refused.body.message, /interdit les œuvres dérivées/);
  });

  test("paramètres : confidentialité, notifications, mot de passe", async () => {
    const defaults = (await call("GET", "/api/users/me/settings", B)).body;
    assert.deepEqual(defaults.privacy, { allowFriendRequests: true, showInSearch: true, defaultVisibility: "private" });
    assert.equal(defaults.deleteConsequences.length, 6);
    assert.equal((await call("PATCH", "/api/users/me/settings", B, { privacy: { showInSearch: "non" } })).status, 400);
    assert.equal((await call("PATCH", "/api/users/me/settings", B, { notificationPrefs: { inconnu: true } })).status, 400);
    const saved = await call("PATCH", "/api/users/me/settings", B, { privacy: { showInSearch: false, allowFriendRequests: false, defaultVisibility: "public" }, notificationPrefs: { remix: false } });
    assert.deepEqual([saved.body.privacy.showInSearch, saved.body.privacy.defaultVisibility, saved.body.notificationPrefs.remix, saved.body.notificationPrefs.message], [false, "public", false, true]);
    assert.equal((await call("GET", "/api/users/search?q=bob", C)).body.users.length, 0, "absent de la recherche");
    assert.equal((await call("POST", "/api/friends/requests", C, { userId: String(B._id) })).status, 403, "n'accepte pas d'invitations");
    const remixNotifications = async () => (await call("GET", "/api/notifications", B)).body.items.filter((item) => item.type === "remix_request").length;
    const before = await remixNotifications();
    assert.equal((await call("POST", `/api/tracks/${tracks.bPublic._id}/remix-requests`, C, {})).status, 201);
    assert.equal(await remixNotifications(), before, "notification de remix coupée : aucune nouvelle");
    await call("PATCH", "/api/users/me/settings", B, { privacy: { showInSearch: true, allowFriendRequests: true } });

    assert.equal((await call("PUT", "/api/users/me/password", C, { currentPassword: "faux", newPassword: "nouveaumotdepasse" })).status, 403);
    assert.equal((await call("PUT", "/api/users/me/password", C, { currentPassword: "motdepasse", newPassword: "court" })).status, 400);
    assert.equal((await call("PUT", "/api/users/me/password", C, { currentPassword: "motdepasse", newPassword: "nouveaumotdepasse" })).status, 204);
    assert.equal(await login("c@test.local", "motdepasse"), 401);
    assert.equal(await login("c@test.local", "nouveaumotdepasse"), 200);
  });

  test("signalements : par les membres, sur ce qu'ils peuvent voir", async () => {
    const reported = await call("POST", "/api/reports", C, { targetType: "track", targetId: mixId, reason: "copyright", details: "Ce mix reprend mon morceau" });
    assert.equal(reported.status, 201);
    assert.equal((await call("POST", "/api/reports", C, { targetType: "track", targetId: mixId, reason: "spam" })).status, 409, "un seul signalement ouvert par cible");
    assert.equal((await call("POST", "/api/reports", A, { targetType: "track", targetId: mixId, reason: "spam" })).status, 400, "pas sa propre piste");
    assert.equal((await call("POST", "/api/reports", C, { targetType: "track", targetId: String(tracks.bPrivate._id), reason: "spam" })).status, 404, "pas une piste privée d'un autre");
    assert.equal((await call("POST", "/api/reports", C, { targetType: "user", targetId: String(B._id), reason: "motif-inconnu" })).status, 400);
    assert.equal((await call("POST", "/api/reports", C, { targetType: "user", targetId: String(B._id), reason: "harassment" })).status, 201);
  });

  test("administration : réservée aux admins, contenus publics seulement, suspension", async () => {
    assert.equal((await call("GET", "/api/admin/overview", A)).status, 403, "un membre n'est pas admin");
    const overview = (await call("GET", "/api/admin/overview", M)).body;
    assert.deepEqual([overview.openReports, overview.users], [2, 4]);
    const reports = (await call("GET", "/api/admin/reports", M)).body.reports;
    const trackReport = reports.find((report) => report.targetType === "track");
    assert.equal(trackReport.track.title, "Remix renommé");
    assert.equal(trackReport.reporter.name, "Chloé Groove");

    // Contenus privés hors de portée.
    assert.equal((await call("POST", `/api/admin/tracks/${tracks.bPrivate._id}/unpublish`, M)).status, 403);
    assert.equal((await call("DELETE", `/api/admin/tracks/${tracks.bPrivate._id}`, M)).status, 403);
    const privateAudio = await fetch(`${base}/api/tracks/${tracks.bPrivate._id}/audio`, { headers: { Authorization: `Bearer ${token(M)}` } });
    assert.equal(privateAudio.status, 403, "l'admin n'écoute pas les fichiers privés");
    const adminTracks = (await call("GET", "/api/admin/tracks", M)).body.tracks;
    assert.ok(adminTracks.every((track) => track.visibility === "public"), "seulement des contenus publics");
    assert.equal(adminTracks.find((track) => track.id === mixId).openReports, 1);

    // Dépublication à partir du signalement : l'auteur est prévenu.
    const resolved = await call("POST", `/api/admin/reports/${trackReport.id}/resolve`, M, { action: "unpublish", note: "Droits non vérifiés" });
    assert.deepEqual([resolved.body.status, resolved.body.action], ["resolved", "unpublished"]);
    assert.equal(resolved.body.track.hidden, true, "devenue privée : plus aucun détail pour l'admin");
    assert.equal((await call("GET", `/api/public/tracks/${mixId}`)).status, 401);
    assert.equal((await call("GET", "/api/notifications", A)).body.items[0].type, "content_removed");

    // Suspension : jetons refusés tout de suite, connexion refusée, puis levée.
    assert.equal((await call("POST", `/api/admin/users/${B._id}/suspend`, M, {})).status, 400, "raison obligatoire");
    assert.equal((await call("POST", `/api/admin/users/${M._id}/suspend`, M, { reason: "test" })).status, 400, "pas un admin");
    assert.equal((await call("POST", `/api/admin/users/${B._id}/suspend`, M, { reason: "Harcèlement" })).status, 200);
    assert.equal((await call("GET", "/api/users/me", B)).status, 401, "le jeton de Bob est refusé immédiatement");
    assert.equal(await login("b@test.local", "motdepasse"), 403);
    const users = (await call("GET", "/api/admin/users?q=bob", M)).body.users;
    assert.deepEqual([users[0].suspendedReason, users[0].openReports], ["Harcèlement", 1]);
    assert.equal((await call("DELETE", `/api/admin/users/${B._id}/suspend`, M)).status, 200);
    assert.equal((await call("GET", "/api/users/me", B)).status, 200);
    assert.equal(await login("b@test.local", "motdepasse"), 200);
  });

  test("suppression du compte : confirmation, tout est effacé, crédits anonymisés", async () => {
    const bobFile = (await Track.findById(tracks.bPublic._id).select("+storedName").lean()).storedName;
    assert.equal((await call("DELETE", "/api/users/me", B, { password: "motdepasse", confirmation: "oui" })).status, 400);
    assert.equal((await call("DELETE", "/api/users/me", B, { password: "faux", confirmation: "SUPPRIMER" })).status, 403);
    assert.equal((await call("DELETE", "/api/users/me", B, { password: "motdepasse", confirmation: "SUPPRIMER" })).status, 204);
    assert.equal((await call("GET", "/api/users/me", B)).status, 401, "jeton refusé tout de suite");
    assert.equal(await login("b@test.local", "motdepasse"), 401);
    assert.equal(await Track.countDocuments({ ownerId: B._id }), 0);
    assert.equal(fs.existsSync(path.join("data", "uploads", bobFile)), false, "fichier effacé du disque");
    const credits = (await call("GET", `/api/tracks?limit=20`, A)).body.docs.find((track) => track.id === mixId).credits;
    assert.equal(credits.sources.find((source) => source.title === "Basse de Bob").ownerName, "Compte supprimé");
    assert.equal((await call("GET", "/api/remix-requests?box=outgoing", A)).body.requests.length, 0, "demandes liées effacées");
  });
});
