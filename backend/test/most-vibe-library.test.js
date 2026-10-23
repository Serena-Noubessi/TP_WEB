/**
 * Tests d'intégration MOST VIBE (sections 4 et 5) sur une base MongoDB SÉPARÉE
 * (« most-vibe-test-library », distincte de celle de most-vibe-public.test.js
 * car node --test exécute les fichiers en parallèle). Ignorés sans MONGODB_URI.
 *
 * Comptes : A (Alice) propriétaire, B (Bob) à qui elle donne accès, C (Chloé) sans accès.
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
import { migrateDown, migrateUp } from "../src/migrations/runner.js";

const TEST_DB = "most-vibe-test-library";
const skip = !process.env.MONGODB_URI && "MONGODB_URI absent : tests d'intégration ignorés";
const secret = process.env.JWT_SECRET || "tp1-development-secret";
let server, base, A, B, C, tracks;
const storedFiles = [];

async function createTrack(owner, fields) {
  const storedName = `test-${new mongoose.Types.ObjectId()}.mp3`;
  await fsPromises.writeFile(path.join("data", "uploads", storedName), Buffer.from(`audio ${fields.title}`));
  storedFiles.push(storedName);
  return Track.create({ ownerId: owner._id, originalName: "a.mp3", storedName, mimeType: "audio/mpeg", size: 10, ...fields });
}

const headers = (user) => ({ Authorization: `Bearer ${jwt.sign({ sub: String(user._id) }, secret)}`, "Content-Type": "application/json" });
const call = (method, url, user, body) =>
  fetch(base + url, { method, headers: user ? headers(user) : {}, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (response) => ({ status: response.status, body: response.status === 204 ? null : await response.json() });

test.describe("MOST VIBE — bibliothèque, réactions et accès", { skip }, () => {
  test.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
    assert.equal(mongoose.connection.db.databaseName, TEST_DB, "sécurité : jamais la vraie base");
    await mongoose.connection.db.dropDatabase();
    A = await User.create({ name: "Alice Vibe", email: "a@test.local", password: "motdepasse" });
    B = await User.create({ name: "Bob Beat", email: "b@test.local", password: "motdepasse" });
    C = await User.create({ name: "Chloé Sound", email: "c@test.local", password: "motdepasse" });
    // Depuis la section 6, « Amis choisis » exige une amitié : A est amie avec B et avec C.
    for (const friend of [B, C]) {
      await Friendship.create({ requesterId: A._id, recipientId: friend._id, pairKey: pairKey(A._id, friend._id), status: "accepted", acceptedAt: new Date() });
    }
    tracks = {
      aPublic: await createTrack(A, { title: "Soleil Afro", style: "afro", visibility: "public", album: "Lumière" }),
      aPrivate: await createTrack(A, { title: "Démo secrète", style: "pop", visibility: "private", album: "Lumière" }),
      aFriends: await createTrack(A, { title: "Pour mes amis", style: "jazz", visibility: "private" }),
    };
    server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    server?.close();
    for (const name of storedFiles) await fsPromises.unlink(path.join("data", "uploads", name)).catch(() => undefined);
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  test("migration 002 : up puis down sans perte puis up (avec la 003 et la 004 par-dessus)", async () => {
    const db = mongoose.connection.db;
    const quiet = () => undefined;
    await migrateUp(db, quiet);
    const names = async () => (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name);
    for (const name of ["reactions", "trackaccesses", "playlists", "externaltracks"]) assert.ok((await names()).includes(name), name);
    await db.collection("playlists").insertOne({ ownerId: A._id, name: "à garder", trackIds: [] });
    await migrateDown(db, 3, quiet); // annule 004, 003 puis 002
    const after = await names();
    assert.ok(!after.includes("reactions"), "collection vide supprimée");
    const renamed = after.find((name) => name.startsWith("rollback002_playlists_"));
    assert.ok(renamed, "collection non vide renommée, pas effacée");
    assert.equal(await db.collection(renamed).countDocuments(), 1);
    await db.collection(renamed).drop();
    // Les migrations 003 et 004 ont renommé (sans les perdre) les collections non vides
    // créées pour ce test (amitiés…) : on les remet en place.
    for (const name of after.filter((item) => /^rollback00[34]_.+_\d+$/.test(item))) {
      await db.collection(name).rename(name.replace(/^rollback00[34]_/, "").replace(/_\d+$/, ""));
    }
    await migrateUp(db, quiet);
    assert.equal(await db.collection("friendships").countDocuments(), 2, "amitiés retrouvées après l'annulation");
  });

  test("j'aime et favoris : visiteur refusé, idempotent, compteur public", async () => {
    const id = tracks.aPublic.id;
    assert.equal((await call("POST", `/api/tracks/${id}/like`)).status, 401, "un visiteur doit se connecter");
    assert.equal((await json(await call("POST", `/api/tracks/${id}/like`, B))).body.likeCount, 1);
    assert.equal((await json(await call("POST", `/api/tracks/${id}/like`, B))).body.likeCount, 1, "pas de doublon");
    assert.equal((await json(await call("POST", `/api/tracks/${id}/like`, C))).body.likeCount, 2);
    await call("POST", `/api/tracks/${id}/favorite`, B);
    const reactions = (await json(await call("GET", "/api/me/reactions", B))).body;
    assert.deepEqual(reactions, { likes: [id], favorites: [id] });
    const fiche = (await json(await call("GET", `/api/public/tracks/${id}`))).body;
    assert.equal(fiche.likeCount, 2);
    assert.equal((await json(await call("DELETE", `/api/tracks/${id}/like`, C))).body.likeCount, 1);
    assert.equal((await call("POST", `/api/tracks/${tracks.aPrivate.id}/like`, C)).status, 403, "pas de réaction sur une piste privée d'un autre");
    const favorites = (await json(await call("GET", "/api/me/favorites", B))).body.docs;
    assert.deepEqual(favorites.map((track) => track.title), ["Soleil Afro"]);
  });

  test("recherche de profils : nom seulement, jamais l'email, pas soi-même", async () => {
    assert.equal((await call("GET", "/api/users/search?q=b")).status, 401);
    assert.equal((await call("GET", "/api/users/search?q=b", A)).status, 400, "2 caractères minimum");
    const { users } = (await json(await call("GET", "/api/users/search?q=bob", A))).body;
    assert.deepEqual(users, [{ id: String(B._id), name: "Bob Beat", relation: "friend", requestId: null }]);
    const self = (await json(await call("GET", "/api/users/search?q=alice", A))).body.users;
    assert.equal(self.length, 0);
  });

  test("Amis choisis : A donne accès à B, C reste refusé, retrait puis message", async () => {
    const id = tracks.aFriends.id;
    const audio = (user) => fetch(`${base}/api/tracks/${id}/audio`, { headers: user ? { Authorization: headers(user).Authorization } : {} });
    assert.equal((await audio(B)).status, 403, "avant partage, B est refusé");

    assert.equal((await call("POST", `/api/tracks/${id}/access`, B, { userIds: [String(C._id)] })).status, 404, "seule la propriétaire gère les accès");
    const granted = await json(await call("POST", `/api/tracks/${id}/access`, A, { userIds: [String(B._id)] }));
    assert.equal(granted.status, 201);
    assert.equal(granted.body.visibility, "friends", "une piste privée passe en « Amis choisis »");
    assert.deepEqual(granted.body.grants.map((grant) => [grant.user.name, grant.active]), [["Bob Beat", true]]);

    const okB = await audio(B);
    assert.equal(okB.status, 200, "B écoute la piste partagée");
    await okB.arrayBuffer();
    assert.equal((await audio(C)).status, 403, "C n'a pas accès");
    assert.equal((await audio()).status, 401, "un visiteur doit se connecter");
    const publicSearch = (await json(await call("GET", "/api/public/tracks?q=amis"))).body;
    assert.equal(publicSearch.totalDocs, 0, "une piste « Amis choisis » n'apparaît pas dans la recherche publique");
    const shared = (await json(await call("GET", "/api/me/shared", B))).body.docs;
    assert.deepEqual(shared.map((track) => [track.title, track.sharedVia]), [["Pour mes amis", "share"]]);

    const revoked = await json(await call("DELETE", `/api/tracks/${id}/access/${B._id}`, A));
    assert.equal(revoked.status, 200);
    assert.match(revoked.body.notice, /déjà téléchargé ne peut pas être récupéré/);
    assert.equal(revoked.body.grants[0].active, false, "la trace du retrait est gardée");
    assert.equal((await audio(B)).status, 403, "après retrait, B est refusé immédiatement");
    assert.equal((await json(await call("GET", "/api/me/shared", B))).body.docs.length, 0);
    assert.equal((await call("DELETE", `/api/tracks/${id}/access/${B._id}`, A)).status, 404, "déjà retiré");
  });

  test("repasser en Privé retire les accès « Amis choisis »", async () => {
    const id = tracks.aFriends.id;
    await call("POST", `/api/tracks/${id}/access`, A, { userIds: [String(B._id), String(C._id)] });
    const patched = await json(await call("PATCH", `/api/tracks/${id}`, A, { visibility: "private" }));
    assert.equal(patched.body.revokedAccesses, 2);
    assert.equal((await fetch(`${base}/api/tracks/${id}/audio`, { headers: { Authorization: headers(C).Authorization } })).status, 403);
  });

  test("playlists : seules les pistes accessibles au lecteur sont montrées", async () => {
    assert.equal((await call("POST", "/api/playlists", A, { name: "" })).status, 400);
    const created = await json(await call("POST", "/api/playlists", A, { name: "Ma sélection", visibility: "public" }));
    assert.equal(created.status, 201);
    const pid = created.body.id;
    await call("POST", `/api/playlists/${pid}/tracks`, A, { trackId: tracks.aPublic.id });
    await call("POST", `/api/playlists/${pid}/tracks`, A, { trackId: tracks.aPrivate.id });
    const again = await json(await call("POST", `/api/playlists/${pid}/tracks`, A, { trackId: tracks.aPublic.id }));
    assert.equal(again.body.trackCount, 2, "pas de doublon");

    const asOwner = (await json(await call("GET", `/api/playlists/${pid}`, A))).body;
    assert.equal(asOwner.tracks.length, 2);
    const asC = (await json(await call("GET", `/api/playlists/${pid}`, C))).body;
    assert.deepEqual(asC.tracks.map((track) => track.title), ["Soleil Afro"], "la piste privée reste cachée");
    assert.equal(asC.hiddenCount, 1);

    assert.equal((await call("POST", `/api/playlists/${pid}/tracks`, C, { trackId: tracks.aPublic.id })).status, 404, "C ne modifie pas la playlist d'A");
    const cList = await json(await call("POST", "/api/playlists", C, { name: "Chez C" }));
    assert.equal((await call("POST", `/api/playlists/${cList.body.id}/tracks`, C, { trackId: tracks.aPrivate.id })).status, 403);
    await call("PATCH", `/api/playlists/${pid}`, A, { visibility: "private" });
    assert.equal((await call("GET", `/api/playlists/${pid}`, C)).status, 404, "playlist privée invisible");
    assert.equal((await call("DELETE", `/api/playlists/${pid}`, A)).status, 204);
  });

  test("albums de l'utilisateur", async () => {
    const { albums } = (await json(await call("GET", "/api/me/albums", A))).body;
    assert.equal(albums.length, 1);
    assert.equal(albums[0].title, "Lumière");
    assert.equal(albums[0].count, 2);
    assert.equal(albums[0].publicCount, 1);
    assert.equal((await json(await call("GET", "/api/me/albums", C))).body.albums.length, 0);
  });

  test("morceaux en ligne enregistrés en base, sans doublon, par propriétaire", async () => {
    const item = { title: "Libre", artist: "Artiste", audioUrl: "https://example.org/libre.mp3", sourceId: "url", sourceLabel: "Lien direct", style: "pop" };
    assert.equal((await call("POST", "/api/external-tracks", A, { ...item, audioUrl: "javascript:alert(1)" })).status, 400);
    const created = await json(await call("POST", "/api/external-tracks", A, item));
    assert.equal(created.status, 201);
    assert.equal(created.body.online.audioUrl, item.audioUrl);
    const batch = await json(await call("POST", "/api/external-tracks", A, { items: [item, { ...item, audioUrl: "https://example.org/2.mp3" }, { title: "" }] }));
    assert.equal(batch.body.docs.length, 2);
    assert.equal(batch.body.rejected.length, 1);
    assert.equal((await json(await call("GET", "/api/external-tracks", A))).body.docs.length, 2, "même adresse = pas de doublon");
    assert.equal((await json(await call("GET", "/api/external-tracks", C))).body.docs.length, 0, "chacun ne voit que les siens");
    assert.equal((await call("DELETE", `/api/external-tracks/${created.body.id}`, C)).status, 404);
    assert.equal((await call("DELETE", `/api/external-tracks/${created.body.id}`, A)).status, 204);
  });

  test("supprimer une piste efface ses réactions, accès et entrées de playlist", async () => {
    const extra = await createTrack(A, { title: "Éphémère", visibility: "public" });
    await call("POST", `/api/tracks/${extra.id}/like`, B);
    await call("POST", `/api/tracks/${extra.id}/access`, A, { userIds: [String(C._id)] });
    const playlist = (await json(await call("POST", "/api/playlists", B, { name: "B" }))).body;
    await call("POST", `/api/playlists/${playlist.id}/tracks`, B, { trackId: extra.id });
    assert.equal((await call("DELETE", `/api/tracks/${extra.id}`, A)).status, 204);
    const db = mongoose.connection.db;
    assert.equal(await db.collection("reactions").countDocuments({ trackId: extra._id }), 0);
    assert.equal(await db.collection("trackaccesses").countDocuments({ trackId: extra._id }), 0);
    assert.equal((await json(await call("GET", `/api/playlists/${playlist.id}`, B))).body.trackCount, 0);
  });
});
