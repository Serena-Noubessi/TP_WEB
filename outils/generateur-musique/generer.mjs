/**
 * Génère des morceaux instrumentaux libres de droits, classés par genre, en MP3.
 *
 *   node generer.mjs                       → 50 morceaux pour chacun des 8 genres
 *   node generer.mjs --par-genre 2         → 2 morceaux par genre (essai rapide)
 *   node generer.mjs --genres house,techno --par-genre 10
 *   node generer.mjs --sortie ../../musiques-generees --duree 90
 *
 * Chaque morceau est entièrement déterminé par sa graine : relancer la commande
 * reproduit exactement les mêmes fichiers.
 */
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { composeTrack, GENRES, makeTitle } from './compositeur.mjs';
import { createRng } from './moteur.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GENRE_ORDER = ['house', 'dance-house', 'electro', 'pop', 'hip-hop', 'techno', 'dubstep', 'autre'];

/* ------------------------------------------------------------------ MP3 --- */

/**
 * lamejs 1.2.1 : le point d'entrée Node est cassé (« MPEGMode is not defined »),
 * on charge donc la version groupée `lame.all.js`. Elle est évaluée dans une
 * fonction et non dans un contexte `vm` : dans un contexte `vm`, chaque accès
 * aux variables globales du script passe par un intercepteur, ce qui rendait
 * l'encodage environ 5 fois plus lent.
 */
function loadLame() {
  const require = createRequire(import.meta.url);
  const source = readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8');
  return new Function(`${source};return lamejs;`)();
}

function encodeMp3(lame, left, right, kbps = 128) {
  const encoder = new lame.Mp3Encoder(2, 44100, kbps);
  const toInt16 = (data) => {
    const out = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767)));
    return out;
  };
  const l = toInt16(left);
  const r = toInt16(right);
  const chunks = [];
  for (let i = 0; i < l.length; i += 1152) {
    const encoded = encoder.encodeBuffer(l.subarray(i, i + 1152), r.subarray(i, i + 1152));
    if (encoded.length) chunks.push(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.length));
  }
  const last = encoder.flush();
  if (last.length) chunks.push(Buffer.from(last.buffer, last.byteOffset, last.length));
  return Buffer.concat(chunks);
}

/** Étiquette ID3v2.3 (titre, artiste, album, genre, BPM, tonalité) en UTF-16. */
function id3Tag(fields) {
  const frames = Object.entries(fields).map(([id, text]) => {
    const body = Buffer.concat([Buffer.from([1]), Buffer.from(`﻿${text}`, 'utf16le')]);
    const header = Buffer.alloc(10);
    header.write(id, 0, 'latin1');
    header.writeUInt32BE(body.length, 4);
    return Buffer.concat([header, body]);
  });
  const content = Buffer.concat(frames);
  const size = content.length;
  const header = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]);
  return Buffer.concat([header, content]);
}

const slugify = (text) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------------------------------------------------------------- Worker --- */

if (!isMainThread) {
  const lame = loadLame();
  parentPort.on('message', (job) => {
    if (job === null) {
      process.exit(0);
    }
    const started = Date.now();
    const { audio, meta } = composeTrack({ genreKey: job.genreKey, seed: job.seed, targetSeconds: job.seconds });
    const title = meta.subgenre ? `${job.title} (${meta.subgenre})` : job.title;
    const fileName = `${String(job.number).padStart(2, '0')}-${slugify(job.title)}-${meta.bpm}bpm-${slugify(meta.key)}.mp3`;
    const tag = id3Tag({
      TIT2: title,
      TPE1: 'Générateur TP Mixage',
      TALB: `Musiques générées — ${meta.genre}`,
      TCON: meta.subgenre ? `${meta.genre} / ${meta.subgenre}` : meta.genre,
      TBPM: String(meta.bpm),
      TKEY: meta.key,
      TRCK: String(job.number),
    });
    const mp3 = encodeMp3(lame, audio.left, audio.right);
    const relative = path.join(job.folder, fileName);
    writeFileSync(path.join(job.outDir, relative), Buffer.concat([tag, mp3]));
    parentPort.postMessage({
      ...meta,
      title,
      number: job.number,
      seed: job.seed,
      file: relative.replace(/\\/g, '/'),
      sizeKb: Math.round((tag.length + mp3.length) / 1024),
      ms: Date.now() - started,
    });
  });
}

/* ------------------------------------------------------------------ Main --- */

if (isMainThread) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const perGenre = Number(option('par-genre', 50));
  const seconds = Number(option('duree', 90));
  const outDir = path.resolve(HERE, option('sortie', '../../musiques-generees'));
  const genres = option('genres', GENRE_ORDER.join(',')).split(',').map((key) => key.trim()).filter((key) => GENRES[key]);

  // Titres et graines choisis à l'avance pour que le résultat ne dépende pas de l'ordre des workers.
  const jobs = [];
  genres.forEach((genreKey, genreIndex) => {
    const folder = `${String(genreIndex + 1).padStart(2, '0')}-${GENRES[genreKey].slug}`;
    mkdirSync(path.join(outDir, folder), { recursive: true });
    const titleRng = createRng(1000 + genreIndex);
    const used = new Set();
    for (let number = 1; number <= perGenre; number++) {
      jobs.push({ genreKey, folder, number, title: makeTitle(titleRng, used), seed: (genreIndex + 1) * 100003 + number * 7919, seconds, outDir });
    }
  });

  const workerCount = Math.max(1, Math.min(jobs.length, availableParallelism() - 1));
  console.log(`[generateur] ${jobs.length} morceaux (${genres.length} genres × ${perGenre}), ${workerCount} workers → ${outDir}`);
  const results = [];
  const started = Date.now();
  let nextJob = 0;

  await new Promise((resolve, reject) => {
    let running = workerCount;
    for (let index = 0; index < workerCount; index++) {
      const worker = new Worker(fileURLToPath(import.meta.url));
      const feed = () => worker.postMessage(nextJob < jobs.length ? jobs[nextJob++] : null);
      worker.on('message', (result) => {
        results.push(result);
        const elapsed = ((Date.now() - started) / 1000).toFixed(0);
        console.log(`[${results.length}/${jobs.length}] ${elapsed}s  ${result.genre}${result.subgenre ? ` / ${result.subgenre}` : ''} — ${result.title} — ${result.bpm} BPM ${result.key} — ${result.sizeKb} Ko`);
        feed();
      });
      worker.on('error', reject);
      worker.on('exit', () => {
        running--;
        if (running === 0) resolve();
      });
      feed();
    }
  });

  results.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(path.join(outDir, 'catalogue.json'), JSON.stringify(results.map(({ ms, ...rest }) => rest), null, 2));
  const csvHeader = 'genre;sous_genre;numero;titre;bpm;tonalite;gamme;mesures;duree_s;structure;fichier;taille_ko;graine';
  const csvRows = results.map((r) => [r.genre, r.subgenre ?? '', r.number, r.title, r.bpm, r.key, r.scale, r.bars, r.seconds, r.structure, r.file, r.sizeKb, r.seed].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'));
  writeFileSync(path.join(outDir, 'catalogue.csv'), `﻿${csvHeader}\n${csvRows.join('\n')}\n`);
  const totalMb = results.reduce((sum, r) => sum + r.sizeKb, 0) / 1024;
  console.log(`[generateur] Terminé en ${((Date.now() - started) / 1000).toFixed(0)} s — ${results.length} fichiers, ${totalMb.toFixed(0)} Mo. Catalogue : catalogue.json / catalogue.csv`);
}
