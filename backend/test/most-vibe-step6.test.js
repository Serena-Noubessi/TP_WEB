/**
 * Tests d'intégration des ajouts du 02/11/2026 sur une base MongoDB SÉPARÉE
 * (« most-vibe-test-step6 ») : forme d'onde, téléchargement, commentaires,
 * abonnements et partage de playlists. Ignorés sans MONGODB_URI.
 *
 * Comptes : A (Alice) et B (Bob) sont amis ; C (Chloé) ne l'est pas ; « visiteur » = sans compte.
 */
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";
import { Friendship, pairKey } from "../src/models/Friendship.js";
import { TrackAccess } from "../src/models/TrackAccess.js";
import { migrateDown, migrateUp } from "../src/migrations/runner.js";

const TEST_DB = "most-vibe-test-step6";
const skip = !process.env.MONGODB_URI && "MONGODB_URI absent : tests d'intégration ignorés";
const secret = process.env.JWT_SECRET || "tp1-development-secret";
let server, base, A, B, C, tracks;
const storedFiles = [];
const WAVE = Array.from({ length: 64 }, (_, i) => (i * 7) % 101);

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
  return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json().catch(() => null) };
};
const notifications = async (user) => (await call("GET", "/api/notifications", user)).body.items.map((item) => item.type);

test.describe("Ajouts du 02/11 — forme d'onde, téléchargement, commentaires, abonnements, playlists partagées", { skip }, () => {
  test.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
    assert.equal(mongoose.connection.db.databaseName, TEST_DB, "sécurité : jamais la vraie base");
    await mongoose.connection.db.dropDatabase();
    A = await User.create({ name: "Alice Vibe", email: "a@test.local", password: "motdepasse" });
    B = await User.create({ name: "Bob Beat", email: "b@test.local", password: "motdepasse" });
    C = await User.create({ name: "Chloé Groove", email: "c@test.local", password: "motdepasse" });
    await Friendship.create({ requesterId: A._id, recipientId: B._id, pairKey: pairKey(A._id, B._id), status: "accepted", acceptedAt: new Date() });
    tracks = {
      aPublic: await createTrack(A, { title: "Soleil public", visibility: "public" }),
      aPrivate: await createTrack(A, { title: "Brouillon privé", visibility: "private" }),
      aFriends: await createTrack(A, { title: "Pour Bob", visibility: "friends" }),
    };
    await TrackAccess.create({ trackId: tracks.aFriends._id, ownerId: A._id, userId: B._id, via: "share" });
    server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    server?.close();
    for (const name of storedFiles) await fsPromises.unlink(path.join("data", "uploads", name)).catch(() => undefined);
    for (const track of await Track.find({}).select("+storedName").lean()) {
      await fsPromises.unlink(path.join("data", "uploads", track.storedName)).catch(() => undefined);
    }
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  test("migration 005 : up, down sans perte, puis up", async () => {
    const db = mongoose.connection.db;
    const quiet = () => undefined;
    await migrateUp(db, quiet);
    await db.collection("playlists").insertOne({ ownerId: A._id, name: "à garder", trackIds: [], visibility: "friends", sharedWith: [B._id] });
    await migrateDown(db, 1, quiet);
    const saved = await db.collection("rollback005_playlistshares").findOne({});
    assert.deepEqual(saved.sharedWith.map(String), [String(B._id)], "partage copié avant d'être retiré");
    assert.equal((await db.collection("playlists").findOne({ name: "à garder" })).visibility, "private");
    await db.collection("rollback005_playlistshares").drop();
    await db.collection("playlists").deleteMany({});
    await migrateUp(db, quiet);
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name);
    assert.ok(names.includes("comments") && names.includes("follows"));
  });

  test("forme d'onde : envoyée avec la piste, validée, modifiable par le propriétaire seulement", async () => {
    const form = new FormData();
    form.append("audio", new Blob([Buffer.from("son")], { type: "audio/mpeg" }), "onde.mp3");
    form.append("title", "Avec onde");
    form.append("visibility", "public");
    form.append("waveform", WAVE.join(","));
    const created = await (await fetch(`${base}/api/tracks`, { method: "POST", headers: { Authorization: `Bearer ${token(A)}` }, body: form })).json();
    assert.deepEqual(created.waveform, WAVE);
    const fiche = (await call("GET", `/api/public/tracks/${created.id}`)).body;
    assert.deepEqual(fiche.waveform, WAVE, "visible dans les champs publics");
    assert.equal(fiche.commentCount, 0);

    const bad = new FormData();
    bad.append("audio", new Blob([Buffer.from("son")], { type: "audio/mpeg" }), "x.mp3");
    bad.append("waveform", "1,2,3");
    assert.equal((await fetch(`${base}/api/tracks`, { method: "POST", headers: { Authorization: `Bearer ${token(A)}` }, body: bad })).status, 400, "trop peu de valeurs");
    assert.equal((await call("PATCH", `/api/tracks/${tracks.aPrivate.id}`, A, { waveform: WAVE.map((v) => v + 200) })).status, 400, "valeurs hors limites");
    assert.deepEqual((await call("PATCH", `/api/tracks/${tracks.aPrivate.id}`, A, { waveform: WAVE })).body.waveform, WAVE);
    assert.equal((await call("PATCH", `/api/tracks/${tracks.aPrivate.id}`, B, { waveform: WAVE })).status, 404, "un autre membre ne peut pas l'écrire");
  });

  test("téléchargement : mêmes droits que l'écoute, nom de fichier lisible", async () => {
    const download = (track, user) => fetch(`${base}/api/tracks/${track.id}/download`, { headers: user ? { Authorization: `Bearer ${token(user)}` } : {} });
    const pub = await download(tracks.aPublic);
    assert.equal(pub.status, 200, "piste publique : visiteur");
    assert.match(pub.headers.get("content-disposition"), /attachment; filename="Soleil public\.mp3"/);
    assert.equal(await pub.text(), "audio Soleil public");
    assert.equal((await download(tracks.aPrivate)).status, 401, "privée : visiteur");
    assert.equal((await download(tracks.aPrivate, C)).status, 403, "privée : autre membre");
    assert.equal((await download(tracks.aPrivate, A)).status, 200, "privée : propriétaire");
    assert.equal((await download(tracks.aFriends, B)).status, 200, "amis choisis : Bob");
    assert.equal((await download(tracks.aFriends, C)).status, 403, "amis choisis : Chloé");
  });

  test("commentaires : selon les droits d'écoute ; suppression par l'auteur ou le propriétaire", async () => {
    const pub = `/api/tracks/${tracks.aPublic.id}/comments`;
    assert.equal((await call("GET", pub)).status, 200, "un visiteur lit les avis d'une piste publique");
    assert.equal((await call("POST", pub, null, { text: "Super" })).status, 401, "mais doit se connecter pour en écrire");
    assert.equal((await call("POST", pub, C, { text: "  " })).status, 400);
    const byC = await call("POST", pub, C, { text: "Très bon son !" });
    assert.equal(byC.status, 201, "tout membre peut commenter une piste publique");
    assert.deepEqual([byC.body.author.name, byC.body.mine], ["Chloé Groove", true]);
    assert.ok((await notifications(A)).includes("comment"), "le propriétaire est prévenu");

    const friends = `/api/tracks/${tracks.aFriends.id}/comments`;
    assert.equal((await call("GET", friends, C)).status, 403, "Chloé n'a pas accès à la piste « amis choisis »");
    assert.equal((await call("POST", friends, C, { text: "?" })).status, 403);
    const byB = await call("POST", friends, B, { text: "Merci pour le partage" });
    assert.equal(byB.status, 201, "Bob, ami choisi, peut commenter");

    const list = (await call("GET", pub, A)).body;
    assert.deepEqual([list.total, list.comments[0].canDelete, list.comments[0].mine], [1, true, false], "le propriétaire peut supprimer");
    assert.equal((await call("DELETE", `/api/comments/${byC.body.id}`, B)).status, 403, "un tiers ne peut pas supprimer");
    assert.equal((await call("DELETE", `/api/comments/${byC.body.id}`, A)).status, 204, "le propriétaire de la piste peut supprimer");
    assert.equal((await call("DELETE", `/api/comments/${byB.body.id}`, B)).status, 204, "l'auteur peut supprimer");
    assert.equal((await call("GET", `/api/public/tracks/${tracks.aPublic.id}`)).body.commentCount, 0);
  });

  test("abonnements : suivre un artiste, ses publications publiques seulement", async () => {
    assert.equal((await call("POST", `/api/users/${C._id}/follow`, C)).status, 400, "pas soi-même");
    const followed = await call("POST", `/api/users/${A._id}/follow`, C);
    assert.deepEqual([followed.status, followed.body.followers], [201, 1]);
    assert.equal((await call("POST", `/api/users/${A._id}/follow`, C)).status, 200, "sans doublon");
    assert.ok((await notifications(A)).includes("follow"));

    const feed = (await call("GET", "/api/feed", C)).body;
    const titles = feed.items.map((item) => item.track.title);
    assert.ok(titles.includes("Soleil public"), "le fil montre ses pistes publiques");
    assert.ok(!titles.includes("Brouillon privé") && !titles.includes("Pour Bob"), "jamais ses pistes privées ou « amis choisis »");

    // Une nouvelle publication publique prévient les abonnés.
    await call("PATCH", `/api/tracks/${tracks.aPrivate.id}`, A, { visibility: "public" });
    assert.ok((await notifications(C)).includes("new_release"), "nouvelle publication annoncée");
    await call("PATCH", `/api/tracks/${tracks.aPrivate.id}`, A, { visibility: "private" });

    const profile = (await call("GET", `/api/users/${A._id}/profile`, C)).body;
    assert.deepEqual([profile.followers, profile.isFollowing], [1, true]);
    const mine = (await call("GET", "/api/me/follows", C)).body;
    assert.deepEqual(mine.following.map((item) => item.user.name), ["Alice Vibe"]);

    // Un blocage supprime l'abonnement et empêche d'en refaire un.
    await call("POST", "/api/blocks", A, { userId: String(C._id) });
    assert.equal((await call("GET", "/api/me/follows", C)).body.following.length, 0);
    assert.equal((await call("POST", `/api/users/${A._id}/follow`, C)).status, 403);
    await call("DELETE", `/api/blocks/${C._id}`, A);
    assert.equal((await call("DELETE", `/api/users/${A._id}/follow`, C)).body.following, false);
  });

  test("playlist partagée : amis choisis, retrait, pistes filtrées pour chaque lecteur", async () => {
    const created = (await call("POST", "/api/playlists", A, { name: "Ma sélection" })).body;
    for (const track of [tracks.aPublic, tracks.aPrivate]) await call("POST", `/api/playlists/${created.id}/tracks`, A, { trackId: track.id });
    assert.equal((await call("POST", `/api/playlists/${created.id}/share`, A, { userIds: [String(C._id)] })).status, 403, "Chloé n'est pas une amie");
    const shared = await call("POST", `/api/playlists/${created.id}/share`, A, { userIds: [String(B._id)] });
    assert.deepEqual([shared.status, shared.body.visibility, shared.body.sharedWith.map((user) => user.name)], [201, "friends", ["Bob Beat"]]);
    assert.ok((await notifications(B)).includes("playlist_shared"));

    const asB = (await call("GET", `/api/playlists/${created.id}`, B)).body;
    assert.deepEqual(asB.tracks.map((track) => track.title), ["Soleil public"], "la piste privée d'Alice reste cachée");
    assert.equal(asB.hiddenCount, 1);
    assert.equal(asB.sharedWith, undefined, "seule la propriétaire voit la liste des personnes");
    assert.equal((await call("GET", `/api/playlists/${created.id}`, C)).status, 404);
    assert.equal((await call("GET", `/api/playlists/${created.id}`)).status, 404, "pas un visiteur");
    assert.deepEqual((await call("GET", "/api/me/shared-playlists", B)).body.playlists.map((p) => [p.name, p.owner.name]), [["Ma sélection", "Alice Vibe"]]);

    assert.equal((await call("DELETE", `/api/playlists/${created.id}/share/${B._id}`, A)).status, 200);
    assert.equal((await call("GET", `/api/playlists/${created.id}`, B)).status, 404, "retrait immédiat");

    await call("PATCH", `/api/playlists/${created.id}`, A, { visibility: "public" });
    const asVisitor = (await call("GET", `/api/playlists/${created.id}`)).body;
    assert.deepEqual(asVisitor.tracks.map((track) => track.title), ["Soleil public"], "publique : visible sans compte, pistes publiques seulement");
    assert.deepEqual((await call("GET", `/api/users/${A._id}/profile`, C)).body.playlists.map((p) => p.name), ["Ma sélection"], "visible sur son profil");
  });

  test("suppression d'une piste : ses commentaires disparaissent", async () => {
    const extra = await createTrack(A, { title: "Éphémère", visibility: "public" });
    await call("POST", `/api/tracks/${extra.id}/comments`, B, { text: "Bientôt supprimée" });
    assert.equal((await call("DELETE", `/api/tracks/${extra.id}`, A)).status, 204);
    assert.equal(await mongoose.connection.db.collection("comments").countDocuments({ trackId: extra._id }), 0);
  });
});
