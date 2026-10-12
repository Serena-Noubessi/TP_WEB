import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("health sans dépendre de MongoDB", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "ok");
});

test("schémas Mongoose et relation", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
  assert.equal(typeof Track.aggregatePaginate, "function");
  const t = new Track({
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  });
  
  assert.equal(t.title, "Blues");
  assert.equal(Track.schema.path("ownerId").options.ref, "User");
  assert.equal(t.toPublic().coverUrl, null);
});

test("pagination HTTP utilise aggregatePaginate et renvoie ses métadonnées", async () => {
  const originalAggregatePaginate = Track.aggregatePaginate;
  const ownerId = new mongoose.Types.ObjectId();
  const trackId = new mongoose.Types.ObjectId();
  let receivedOptions;
  let receivedPipeline;

  Track.aggregatePaginate = async (aggregate, options) => {
    receivedOptions = options;
    receivedPipeline = aggregate.pipeline();
    return {
      docs: [{
        _id: trackId,
        title: "Blues",
        storedName: "private.mp3",
        coverStoredName: "private.png",
        coverMimeType: "image/png",
      }],
      totalDocs: 6,
      limit: 5,
      page: 2,
      totalPages: 2,
      nextPage: null,
      prevPage: 1,
      hasPrevPage: true,
      hasNextPage: false,
      pagingCounter: 6,
    };
  };

  const token = jwt.sign(
    { sub: String(ownerId) },
    process.env.JWT_SECRET || "tp1-development-secret",
  );

  try {
    const response = await fetch(`${base}/api/tracks?page=2&limit=5&search=Blues.*`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(receivedOptions, { page: 2, limit: 5 });
    assert.equal(receivedPipeline[0].$match.title.$regex, "Blues\\.\\*");
    assert.equal(receivedPipeline[0].$match.title.$options, "i");
    assert.equal(body.docs[0].id, String(trackId));
    assert.equal(body.docs[0].coverUrl, `/api/tracks/${trackId}/cover`);
    assert.equal("_id" in body.docs[0], false);
    assert.equal(body.totalDocs, 6);
    assert.equal(body.totalPages, 2);
    assert.equal("storedName" in body.docs[0], false);
    assert.equal("coverStoredName" in body.docs[0], false);
    assert.equal("coverMimeType" in body.docs[0], false);
    assert.equal(body.hasPrevPage, true);
    assert.equal(body.hasNextPage, false);
  } finally {
    Track.aggregatePaginate = originalAggregatePaginate;
  }
});

test("upload et lecture authentifiée d'une couverture", async () => {
  const originalCreate = Track.create;
  const originalFindOne = Track.findOne;
  const ownerId = new mongoose.Types.ObjectId();
  const token = jwt.sign(
    { sub: String(ownerId) },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const audioBytes = Buffer.from("audio fixture");
  const coverBytes = Buffer.from("cover fixture");
  const createdTracks = [];

  Track.create = async (data) => {
    const createdTrack = new Track(data);
    createdTracks.push(createdTrack);
    return createdTrack;
  };

  try {
    const form = new FormData();
    form.append("audio", new Blob([audioBytes], { type: "audio/mpeg" }), "song.mp3");
    form.append("title", "Test cover");
    form.append("cover", new Blob([coverBytes], { type: "image/png" }), "cover.png");
    const response = await fetch(`${base}/api/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.title, "Test cover");
    assert.equal(body.coverUrl, `/api/tracks/${body.id}/cover`);
    assert.equal("coverStoredName" in body, false);

    let receivedFilter;
    Track.findOne = (filter) => {
      receivedFilter = filter;
      return {
        select: async () => ({
          id: body.id,
          coverStoredName: createdTracks[0].coverStoredName,
          coverMimeType: createdTracks[0].coverMimeType,
        }),
      };
    };
    const coverResponse = await fetch(`${base}${body.coverUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(coverResponse.status, 200);
    assert.equal(coverResponse.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await coverResponse.arrayBuffer()), coverBytes);
    assert.equal(String(receivedFilter.ownerId), String(ownerId));

    const audioOnlyForm = new FormData();
    audioOnlyForm.append("audio", new Blob([audioBytes], { type: "audio/mpeg" }), "audio-only.mp3");
    const audioOnlyResponse = await fetch(`${base}/api/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: audioOnlyForm,
    });
    const audioOnlyTrack = await audioOnlyResponse.json();

    assert.equal(audioOnlyResponse.status, 201);
    assert.equal(audioOnlyTrack.coverUrl, null);
  } finally {
    Track.create = originalCreate;
    Track.findOne = originalFindOne;
    for (const createdTrack of createdTracks) {
      for (const filename of [createdTrack.storedName, createdTrack.coverStoredName]) {
        if (!filename) continue;
        await fsPromises.unlink(path.join("data", "uploads", filename)).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    }
  }
});
