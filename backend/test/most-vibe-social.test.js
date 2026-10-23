/**
 * Tests d'intégration MOST VIBE (sections 6 et 7) sur une base MongoDB SÉPARÉE
 * (« most-vibe-test-social »). Ignorés sans MONGODB_URI.
 *
 * Comptes : A (Alice) et B (Bob) deviennent amis ; C (Chloé) n'est pas amie avec eux.
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

const TEST_DB = "most-vibe-test-social";
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
const call = async (method, url, user, body) => {
  const response = await fetch(base + url, { method, headers: user ? headers(user) : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
};
const audio = async (track, user) => {
  const response = await fetch(`${base}/api/tracks/${track.id}/audio`, { headers: user ? { Authorization: headers(user).Authorization } : {} });
  await response.arrayBuffer();
  return response.status;
};

test.describe("MOST VIBE — amis, blocage, fil d'activité et messagerie", { skip }, () => {
  test.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
    assert.equal(mongoose.connection.db.databaseName, TEST_DB, "sécurité : jamais la vraie base");
    await mongoose.connection.db.dropDatabase();
    A = await User.create({ name: "Alice Vibe", email: "a@test.local", password: "motdepasse" });
    B = await User.create({ name: "Bob Beat", email: "b@test.local", password: "motdepasse" });
    C = await User.create({ name: "Chloé Sound", email: "c@test.local", password: "motdepasse" });
    tracks = {
      aPublic: await createTrack(A, { title: "Soleil public", visibility: "public" }),
      aPrivate: await createTrack(A, { title: "Brouillon privé", visibility: "private" }),
      aMix: await createTrack(A, { title: "Mix du dimanche", visibility: "public", kind: "mix" }),
      bTrack: await createTrack(B, { title: "Piste de Bob", visibility: "private" }),
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

  test("invitation : envoyer, recevoir, accepter ; notifications et compteurs", async () => {
    assert.equal((await call("POST", "/api/friends/requests", A, { userId: String(A._id) })).status, 400, "pas d'invitation à soi-même");
    const sent = await call("POST", "/api/friends/requests", A, { userId: String(B._id) });
    assert.equal(sent.status, 201);
    assert.equal((await call("POST", "/api/friends/requests", A, { userId: String(B._id) })).status, 409, "pas de doublon");

    const bFriends = (await call("GET", "/api/friends", B)).body;
    assert.deepEqual(bFriends.incoming.map((item) => item.user.name), ["Alice Vibe"]);
    assert.equal((await call("GET", "/api/me/counters", B)).body.invitations, 1);
    const bNotifications = (await call("GET", "/api/notifications", B)).body;
    assert.equal(bNotifications.items[0].type, "friend_request");
    assert.equal(bNotifications.unread, 1);

    assert.equal((await call("POST", `/api/friends/requests/${sent.body.requestId}/accept`, C)).status, 404, "seul le destinataire accepte");
    assert.equal((await call("POST", `/api/friends/requests/${sent.body.requestId}/accept`, B)).status, 200);
    assert.deepEqual((await call("GET", "/api/friends", A)).body.friends.map((item) => item.user.name), ["Bob Beat"]);
    assert.equal((await call("GET", "/api/notifications", A)).body.items[0].type, "friend_accepted");
    assert.equal((await call("POST", "/api/friends/requests", B, { userId: String(A._id) })).status, 409, "déjà amis");
    await call("POST", "/api/notifications/read", B, {});
    assert.equal((await call("GET", "/api/me/counters", B)).body.notifications, 0);
  });

  test("refuser, annuler, invitations croisées, retirer un ami", async () => {
    const toC = await call("POST", "/api/friends/requests", A, { userId: String(C._id) });
    assert.equal((await call("POST", `/api/friends/requests/${toC.body.requestId}/refuse`, C)).status, 204);
    assert.equal((await call("GET", "/api/friends", A)).body.outgoing.length, 0, "refusée = supprimée");

    const again = await call("POST", "/api/friends/requests", A, { userId: String(C._id) });
    assert.equal((await call("DELETE", `/api/friends/requests/${again.body.requestId}`, C)).status, 404, "seul l'expéditeur annule");
    assert.equal((await call("DELETE", `/api/friends/requests/${again.body.requestId}`, A)).status, 204);
    assert.equal((await call("GET", "/api/me/counters", C)).body.invitations, 0);

    await call("POST", "/api/friends/requests", C, { userId: String(A._id) });
    const crossed = await call("POST", "/api/friends/requests", A, { userId: String(C._id) });
    assert.deepEqual([crossed.status, crossed.body.status], [200, "accepted"], "invitations croisées = amis");
    assert.equal((await call("DELETE", `/api/friends/${C._id}`, A)).status, 200);
    assert.equal((await call("GET", "/api/friends", C)).body.friends.length, 0);
    assert.equal((await call("DELETE", `/api/friends/${C._id}`, A)).status, 404);
  });

  test("recherche et profil : relation, et seulement les pistes que le lecteur peut voir", async () => {
    const search = (await call("GET", "/api/users/search?q=vibe", B)).body.users;
    assert.deepEqual(search, [{ id: String(A._id), name: "Alice Vibe", relation: "friend", requestId: null }]);
    assert.equal("email" in search[0], false);
    const asC = (await call("GET", `/api/users/${A._id}/profile`, C)).body;
    assert.equal(asC.relation, "none");
    assert.deepEqual(asC.tracks.map((track) => track.title).sort(), ["Mix du dimanche", "Soleil public"], "jamais la piste privée");
    assert.equal(asC.friendCount, 1);
    assert.equal((await call("GET", `/api/users/${A._id}/profile`, A)).body.relation, "self");
  });

  test("« Amis choisis » réservé aux amis ; fil d'activité filtré", async () => {
    const refused = await call("POST", `/api/tracks/${tracks.aPrivate.id}/access`, A, { userIds: [String(C._id)] });
    assert.equal(refused.status, 403, "C n'est pas amie avec A");
    assert.equal((await call("POST", `/api/tracks/${tracks.aPrivate.id}/access`, A, { userIds: [String(B._id)] })).status, 201);
    assert.equal((await call("GET", "/api/notifications", B)).body.items[0].type, "track_shared");

    const feedB = (await call("GET", "/api/feed", B)).body;
    assert.deepEqual(feedB.items.map((item) => item.track.title).sort(), ["Brouillon privé", "Mix du dimanche", "Soleil public"], "B voit le public et ce qu'on lui a partagé");
    assert.equal(feedB.items.find((item) => item.track.title === "Mix du dimanche").type, "mix_published");
    const feedC = (await call("GET", "/api/feed", C)).body;
    assert.deepEqual([feedC.items.length, feedC.friendCount], [0, 0], "pas d'ami = fil vide");

    // Retirer un ami retire les accès « Amis choisis ».
    await call("POST", "/api/friends/requests", A, { userId: String(C._id) });
    const pending = (await call("GET", "/api/friends", C)).body.incoming[0];
    await call("POST", `/api/friends/requests/${pending.requestId}/accept`, C);
    await call("POST", `/api/tracks/${tracks.aPrivate.id}/access`, A, { userIds: [String(C._id)] });
    assert.equal(await audio(tracks.aPrivate, C), 200);
    const removed = await call("DELETE", `/api/friends/${C._id}`, A);
    assert.equal(removed.body.revokedAccesses, 1);
    assert.equal(await audio(tracks.aPrivate, C), 403, "plus amis = plus d'accès");
  });

  test("messagerie : amis seulement, non lus, carte musicale et « Partage interrompu »", async () => {
    assert.equal((await call("POST", "/api/conversations", A, { userId: String(C._id) })).status, 403, "C n'est pas amie");
    const opened = await call("POST", "/api/conversations", A, { userId: String(B._id) });
    assert.equal(opened.status, 201);
    assert.equal((await call("POST", "/api/conversations", B, { userId: String(A._id) })).body.id, opened.body.id, "une seule conversation par paire");
    const conv = opened.body.id;

    assert.equal((await call("POST", `/api/conversations/${conv}/messages`, B, { text: "   " })).status, 400, "message vide");
    assert.equal((await call("POST", `/api/conversations/${conv}/messages`, B, { text: "Salut Alice !" })).status, 201);
    assert.equal((await call("GET", "/api/me/counters", A)).body.messages, 1);
    assert.equal((await call("GET", "/api/conversations", A)).body.conversations[0].unread, 1);
    await call("POST", `/api/conversations/${conv}/read`, A);
    assert.equal((await call("GET", "/api/me/counters", A)).body.messages, 0);
    assert.equal((await call("GET", `/api/conversations/${conv}/messages`, C)).status, 404, "C ne lit pas la conversation");

    // Piste privée envoyée : accès au seul destinataire.
    const privateTrack = await createTrack(A, { title: "Maquette secrète", visibility: "private", durationSeconds: 95 });
    assert.equal(await audio(privateTrack, B), 403);
    assert.equal((await call("POST", `/api/conversations/${conv}/messages`, A, { trackId: tracks.bTrack.id })).status, 404, "seulement ses propres pistes");
    const card = await call("POST", `/api/conversations/${conv}/messages`, A, { text: "Écoute ça", trackId: privateTrack.id });
    assert.equal(card.status, 201);
    assert.equal(card.body.track.status, "ok");
    assert.equal(card.body.track.recipientAccess, "active");
    assert.equal(await audio(privateTrack, B), 200, "le destinataire peut écouter");
    assert.equal(await audio(privateTrack, C), 403, "personne d'autre");
    assert.equal(privateTrack.visibility, "private");
    const bView = (await call("GET", `/api/conversations/${conv}/messages`, B)).body;
    const bCard = bView.messages.find((message) => message.track).track;
    assert.deepEqual([bCard.status, bCard.title, bCard.durationSeconds, bCard.author.name], ["ok", "Maquette secrète", 95, "Alice Vibe"]);
    const shared = (await call("GET", `/api/tracks/${privateTrack.id}/access`, A)).body.grants;
    assert.deepEqual(shared.map((grant) => [grant.user.name, grant.via]), [["Bob Beat", "message"]]);

    // Retrait de l'accès : la carte devient « Partage interrompu ».
    await call("DELETE", `/api/tracks/${privateTrack.id}/access/${B._id}`, A);
    const after = (await call("GET", `/api/conversations/${conv}/messages`, B)).body.messages.find((message) => message.track).track;
    assert.equal(after.status, "interrupted");
    assert.equal("coverUrl" in after, false, "plus aucun détail exploitable");
    assert.equal(await audio(privateTrack, B), 403);
    const senderView = (await call("GET", `/api/conversations/${conv}/messages`, A)).body.messages.find((message) => message.track).track;
    assert.deepEqual([senderView.status, senderView.recipientAccess], ["ok", "revoked"], "l'expéditrice voit que l'accès est retiré");
  });

  test("blocage : plus d'amitié, d'accès, de messages ni de recherche ; déblocage", async () => {
    const conv = (await call("POST", "/api/conversations", A, { userId: String(B._id) })).body.id;
    await call("POST", `/api/tracks/${tracks.bTrack.id}/access`, B, { userIds: [String(A._id)] });
    assert.equal(await audio(tracks.bTrack, A), 200);

    const blocked = await call("POST", "/api/blocks", B, { userId: String(A._id) });
    assert.equal(blocked.status, 201);
    // 2 accès retirés : celui que B avait donné à A, et celui qu'A avait donné à B (« Amis choisis », test précédent).
    assert.equal(blocked.body.revokedAccesses, 2);
    assert.equal(await audio(tracks.bTrack, A), 403, "les accès donnés à la personne bloquée sont retirés");
    assert.equal(await audio(tracks.aPrivate, B), 403, "et ceux qu'elle avait donnés à celui qui bloque aussi");
    assert.equal((await call("GET", "/api/friends", A)).body.friends.length, 0, "amitié supprimée");
    assert.equal((await call("POST", `/api/conversations/${conv}/messages`, A, { text: "Coucou ?" })).status, 403);
    const read = (await call("GET", `/api/conversations/${conv}/messages`, A)).body;
    assert.deepEqual([read.canSend, read.reason], [false, "blocked"], "historique lisible, envoi impossible");
    assert.equal((await call("POST", "/api/friends/requests", A, { userId: String(B._id) })).status, 403);
    assert.equal((await call("GET", "/api/users/search?q=bob", A)).body.users.length, 0, "masqué de la recherche");
    assert.equal((await call("GET", `/api/users/${B._id}/profile`, A)).status, 404);
    assert.deepEqual((await call("GET", "/api/blocks", B)).body.blocked.map((item) => item.user.name), ["Alice Vibe"]);

    assert.equal((await call("DELETE", `/api/blocks/${A._id}`, B)).status, 204);
    assert.equal((await call("GET", "/api/users/search?q=bob", A)).body.users[0].relation, "none", "débloqué, mais plus amis");
    assert.equal((await call("DELETE", `/api/blocks/${A._id}`, B)).status, 404);
  });
});
