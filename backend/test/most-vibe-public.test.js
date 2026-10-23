/**
 * Tests d'intégration MOST VIBE (sections 1 à 3) sur une base MongoDB SÉPARÉE
 * (« most-vibe-test » sur le même cluster). Les vraies données ne sont jamais
 * touchées. Ignorés si MONGODB_URI n'est pas défini.
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

const TEST_DB = "most-vibe-test";
const skip = !process.env.MONGODB_URI && "MONGODB_URI absent : tests d'intégration ignorés";
const secret = process.env.JWT_SECRET || "tp1-development-secret";
let server, base, alice, bob, tracks;
const storedFiles = [];

async function createTrack(owner, fields) {
  const storedName = `test-${new mongoose.Types.ObjectId()}.mp3`;
  await fsPromises.writeFile(path.join("data", "uploads", storedName), Buffer.from(`audio ${fields.title}`));
  storedFiles.push(storedName);
  return Track.create({ ownerId: owner._id, originalName: "a.mp3", storedName, mimeType: "audio/mpeg", size: 10, ...fields });
}

const bearer = (user) => ({ Authorization: `Bearer ${jwt.sign({ sub: String(user._id) }, secret)}` });

test.describe("MOST VIBE — contenus publics et droits d'accès", { skip }, () => {
  test.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
    assert.equal(mongoose.connection.db.databaseName, TEST_DB, "sécurité : jamais la vraie base");
    await mongoose.connection.db.dropDatabase();
    alice = await User.create({ name: "Alice Vibe", email: "alice@test.local", password: "motdepasse" });
    bob = await User.create({ name: "Bob Beat", email: "bob@test.local", password: "motdepasse" });
    tracks = {
      alicePublic: await createTrack(alice, { title: "Soleil Afro", style: "afro", visibility: "public", tags: ["été"], album: "Lumière" }),
      alicePublic2: await createTrack(alice, { title: "Nuit Electro", style: "electro", visibility: "public", album: "Lumière" }),
      alicePrivate: await createTrack(alice, { title: "Secret Afro Démo", style: "afro", visibility: "private" }),
      bobPublic: await createTrack(bob, { title: "Jazz du matin", style: "jazz", visibility: "public", kind: "mix" }),
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

  test("la recherche publique ne renvoie jamais de piste privée", async () => {
    const all = await (await fetch(`${base}/api/public/tracks?limit=24`)).json();
    assert.equal(all.totalDocs, 3);
    assert.ok(all.docs.every((track) => track.visibility === "public"));
    const secret = await (await fetch(`${base}/api/public/tracks?q=Secret`)).json();
    assert.equal(secret.totalDocs, 0, "le titre privé n'est jamais trouvé");
    const connected = await (await fetch(`${base}/api/public/tracks?q=Secret`, { headers: bearer(alice) })).json();
    assert.equal(connected.totalDocs, 0, "même pour sa propriétaire, la recherche publique reste publique");
  });

  test("recherche par titre, auteur, style, album et tag", async () => {
    const get = async (query) => (await (await fetch(`${base}/api/public/tracks?${query}`)).json()).docs.map((t) => t.title).sort();
    assert.deepEqual(await get("q=soleil"), ["Soleil Afro"]);
    assert.deepEqual(await get("author=bob"), ["Jazz du matin"]);
    assert.deepEqual(await get("style=afro"), ["Soleil Afro"]);
    assert.deepEqual(await get("album=lumi"), ["Nuit Electro", "Soleil Afro"]);
    assert.deepEqual(await get("tag=été"), ["Soleil Afro"]);
    assert.deepEqual(await get("q=beat"), ["Jazz du matin"], "le texte libre cherche aussi l'auteur");
    assert.equal((await fetch(`${base}/api/public/tracks?style=classique`)).status, 400);
    const one = (await (await fetch(`${base}/api/public/tracks?q=soleil`)).json()).docs[0];
    assert.deepEqual(one.author, { id: String(alice._id), name: "Alice Vibe" });
    assert.equal("email" in one.author, false, "l'email de l'auteur n'est jamais exposé");
  });

  test("accueil : sections publiques uniquement", async () => {
    const home = await (await fetch(`${base}/api/public/home`)).json();
    assert.deepEqual(home.recent.map((t) => t.title).sort(), ["Nuit Electro", "Soleil Afro"]);
    assert.deepEqual(home.mixes.map((t) => t.title), ["Jazz du matin"]);
    assert.equal(home.albums.length, 1);
    assert.equal(home.albums[0].title, "Lumière");
    assert.equal(home.albums[0].count, 2);
    assert.equal(home.styles.afro, 1, "la piste afro privée n'est pas comptée");
    assert.ok(home.selection.every((t) => t.visibility === "public"));
  });

  test("lien direct vers l'audio : public pour tous, privé protégé à chaque requête", async () => {
    const audio = (track, headers) => fetch(`${base}/api/tracks/${track._id}/audio`, { headers });
    const visitorPublic = await audio(tracks.alicePublic);
    assert.equal(visitorPublic.status, 200, "un visiteur écoute une piste publique");
    assert.equal(await visitorPublic.text(), "audio Soleil Afro");
    assert.equal((await audio(tracks.alicePrivate)).status, 401, "visiteur → connexion requise");
    assert.equal((await audio(tracks.alicePrivate, bearer(bob))).status, 403, "autre utilisateur → interdit");
    assert.equal((await audio(tracks.alicePrivate, bearer(alice))).status, 200, "propriétaire → autorisé");
    const ranged = await fetch(`${base}/api/tracks/${tracks.alicePublic._id}/audio`, { headers: { Range: "bytes=0-4" } });
    assert.equal(ranged.status, 206, "lecture partielle (Range) prise en charge");
    assert.equal(await ranged.text(), "audio");
    assert.equal((await fetch(`${base}/api/public/tracks/${tracks.alicePrivate._id}`, { headers: bearer(bob) })).status, 403);
  });

  test("seul le propriétaire modifie une piste, avec des valeurs validées", async () => {
    const patch = (track, body, user) => fetch(`${base}/api/tracks/${track._id}`, { method: "PATCH", headers: { ...bearer(user), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await patch(tracks.alicePrivate, { visibility: "public" }, bob)).status, 404, "Bob ne peut pas rendre publique la piste d'Alice");
    assert.equal((await patch(tracks.alicePrivate, { visibility: "partout" }, alice)).status, 400);
    assert.equal((await patch(tracks.alicePrivate, { style: "classique" }, alice)).status, 400);
    const ok = await patch(tracks.alicePrivate, { visibility: "public", tags: "Démo, Afro" }, alice);
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).tags, ["démo", "afro"]);
    assert.equal((await (await fetch(`${base}/api/public/tracks?q=Secret`)).json()).totalDocs, 1, "devenue publique, elle apparaît");
    await patch(tracks.alicePrivate, { visibility: "private" }, alice);
    assert.equal((await (await fetch(`${base}/api/public/tracks?q=Secret`)).json()).totalDocs, 0, "redevenue privée, elle disparaît aussitôt");
  });
});
