/**
 * Compositeur : choisit tempo, tonalité, grille d'accords, motifs de batterie,
 * ligne de basse et mélodie selon le genre, puis arrange le morceau en sections
 * adaptées au mix DJ (intro et outro rythmiques, build, drop, break).
 */
import { clap, createRng, kick, midiToFreq, noiseHit, riser, snare, Song, SR, synth, tonalHit } from './moteur.mjs';

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PROGRESSIONS = {
  minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 5, 3, 4], [0, 2, 5, 4], [0, 3, 5, 4], [0, 0, 5, 6], [0, 4, 5, 3], [0, 5, 6, 4]],
  major: [[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4], [0, 3, 4, 3], [0, 3, 5, 4], [3, 4, 0, 5], [0, 2, 3, 4]],
  hypnotic: [[0, 0, 0, 0], [0, 0, 5, 0], [0, 0, 0, 6], [0, 3, 0, 3], [0, 0, 6, 5]],
};

/* ----------------------------------------------------------------------------
 * Presets d'instruments : fonctions (fréquence, durée, options) → paramètres de synth().
 * -------------------------------------------------------------------------- */
const BASS = {
  house: (freq, dur) => ({ freq, dur, wave: 'saw', sub: 0.6, cutoff: 340, q: 1.2, filterEnv: 1.8, filterDecay: 0.09, a: 0.003, d: 0.15, s: 0.5, r: 0.04, drive: 1.5 }),
  offbeat: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 2, detune: 8, cutoff: 560, filterEnv: 1.3, filterDecay: 0.07, a: 0.002, d: 0.12, s: 0.3, r: 0.03, sub: 0.4 }),
  sub808: (freq, dur, o) => ({ freq, dur, wave: 'sine', glideFrom: o.glideFrom, glideTime: 0.07, a: 0.003, d: 0.9, s: 0.65, r: 0.15, drive: 2.2 }),
  electro: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 2, detune: 12, cutoff: 260, q: 3, filterEnv: 3.2, filterDecay: 0.1, a: 0.002, d: 0.15, s: 0.6, r: 0.04, drive: 3, sub: 0.5 }),
  wobble: (freq, dur, o) => ({ freq, dur, wave: 'saw', voices: 3, detune: 14, sub: 0.9, cutoff: 110, q: 5, lfo: { rate: o.lfoRate, depth: 5 }, a: 0.005, d: 0.1, s: 1, r: 0.05, drive: 3 }),
  reese: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 2, detune: 22, cutoff: 380, q: 1.5, lfo: { rate: 0.25, depth: 1.2 }, sub: 0.7, a: 0.01, d: 0.1, s: 1, r: 0.1, drive: 1.8 }),
  rumble: (freq, dur) => ({ freq, dur, wave: 'sine', a: 0.02, d: 0.16, s: 0, r: 0.05, drive: 2 }),
  pop: (freq, dur) => ({ freq, dur, wave: 'saw', cutoff: 480, filterEnv: 0.8, filterDecay: 0.2, a: 0.004, d: 0.3, s: 0.7, r: 0.08, sub: 0.45 }),
  soft: (freq, dur) => ({ freq, dur, wave: 'sine', a: 0.01, d: 0.4, s: 0.7, r: 0.2, drive: 1.2 }),
};

const CHORDS = {
  stab: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 2, detune: 7, cutoff: 1500, filterEnv: 1.4, filterDecay: 0.12, a: 0.002, d: 0.18, s: 0, r: 0.08 }),
  organ: (freq, dur) => ({ freq, dur, wave: 'square', cutoff: 2600, a: 0.002, d: 0.05, s: 0.75, r: 0.05 }),
  piano: (freq, dur) => ({ freq, dur, wave: 'tri', voices: 2, detune: 3, cutoff: 2200, filterEnv: 1.2, filterDecay: 0.25, a: 0.002, d: 0.9, s: 0.15, r: 0.25 }),
  rhodes: (freq, dur) => ({ freq, dur, wave: 'sine', voices: 2, detune: 5, tremolo: { rate: 4.5, depth: 0.25 }, a: 0.004, d: 1.4, s: 0.35, r: 0.4 }),
  supersaw: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 7, detune: 28, stereo: true, cutoff: 4200, a: 0.008, d: 0.2, s: 0.85, r: 0.18 }),
  pad: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 4, detune: 16, stereo: true, cutoff: 1100, q: 0.9, a: 0.35, d: 0.5, s: 0.85, r: 0.8 }),
  pluck: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 2, detune: 9, cutoff: 700, filterEnv: 3, filterDecay: 0.11, a: 0.001, d: 0.3, s: 0, r: 0.1 }),
};

const LEADS = {
  pluck: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 2, detune: 9, cutoff: 900, filterEnv: 3, filterDecay: 0.12, a: 0.001, d: 0.28, s: 0, r: 0.12 }),
  piano: CHORDS.piano,
  squareLead: (freq, dur) => ({ freq, dur, wave: 'square', voices: 2, detune: 6, cutoff: 2800, a: 0.01, d: 0.2, s: 0.75, r: 0.12, vibrato: { rate: 5.5, depth: 12, delay: 0.2 } }),
  vocal: (freq, dur) => ({ freq, dur, wave: 'tri', cutoff: 3000, a: 0.04, d: 0.3, s: 0.8, r: 0.2, vibrato: { rate: 5, depth: 18, delay: 0.15 } }),
  bell: (freq, dur) => ({ freq, dur, wave: 'sine', a: 0.002, d: 0.8, s: 0, r: 0.5, tremolo: { rate: 6, depth: 0.1 } }),
  flute: (freq, dur) => ({ freq, dur, wave: 'sine', a: 0.06, d: 0.2, s: 0.85, r: 0.15, vibrato: { rate: 5, depth: 15, delay: 0.1 } }),
  supersaw: (freq, dur) => ({ freq, dur, wave: 'saw', voices: 5, detune: 20, stereo: true, cutoff: 5000, a: 0.01, d: 0.2, s: 0.9, r: 0.15 }),
  acid: (freq, dur) => ({ freq, dur, wave: 'saw', cutoff: 320, q: 6, filterEnv: 3.5, filterDecay: 0.12, a: 0.002, d: 0.12, s: 0.4, r: 0.03, drive: 2 }),
};

/* ----------------------------------------------------------------------------
 * Styles : un objet par genre (et par sous-genre de la catégorie « Autre »).
 * Les motifs de batterie sont des grilles de 16 doubles-croches :
 * x = coup, o = coup léger, X = coup accentué, . = silence.
 * Les motifs de basse : 1 fondamentale, 3 tierce, 5 quinte, 8 octave, - tenue.
 * -------------------------------------------------------------------------- */
const FOUR = 'x...x...x...x...';
const BACKBEAT = '....x.......x...';
const OFFBEAT = '..x...x...x...x.';

export const GENRES = {
  house: {
    label: 'House', slug: 'house', form: 'club', kit: 'club', bpm: [120, 126], swing: [0, 0.05], sidechain: 0.3,
    scales: [['minor', 0.55], ['dorian', 0.3], ['major', 0.15]],
    kick: [FOUR], backbeat: [['clap', BACKBEAT]], hatClosed: ['x.x.x.x.x.x.x.x.', 'xoxoxoxoxoxoxoxo', '................'], hatOpen: [OFFBEAT],
    perc: [['shaker', '..x...x...x...xx'], ['rim', '...x.....x....x.'], ['conga', 'x..x..x...x..x..'], ['shaker', 'xoxoxoxoxoxoxoxo']],
    chordStyle: ['stab', 'organ', 'piano'], chordRhythm: ['..x..x....x..x..', 'x..x..x...x.x...', '...x..x....x..x.', '..x...x...x...x.'], pad: 0.5,
    bassStyle: ['house'], bass: ['1..1..8...1..5..', '..1...1...1...1.', '1.....1.8...1...', '1..8..1...1..8..'],
    lead: [['pluck', 0.4], ['piano', 0.35], [null, 0.25]], leadDensity: 0.35,
  },
  'dance-house': {
    label: 'Dance House', slug: 'dance-house', form: 'club', kit: 'club', bpm: [124, 128], swing: [0, 0], sidechain: 0.5,
    scales: [['minor', 0.6], ['major', 0.4]],
    kick: [FOUR], backbeat: [['clap', BACKBEAT], ['snare', BACKBEAT]], hatClosed: ['x.x.x.x.x.x.x.x.', 'oxoxoxoxoxoxoxox'], hatOpen: [OFFBEAT],
    perc: [['shaker', 'xoxoxoxoxoxoxoxo'], [null, '']],
    chordStyle: ['supersaw'], chordRhythm: ['x..x..x.x..x..x.', 'x.......x.......', 'x..x..x...x..x..', 'x-x-x-x-x-x-x-x-'], pad: 1,
    bassStyle: ['offbeat'], bass: ['..1...1...1...1.', '..1-..1-..1-..1-', '..8...1...8...1.'],
    lead: [['pluck', 0.6], ['supersaw', 0.4]], leadDensity: 0.45, riser: true,
  },
  electro: {
    label: 'Electro', slug: 'electro', form: 'club', kit: 'electro', bpm: [125, 130], swing: [0, 0.03], sidechain: 0.35,
    scales: [['minor', 0.6], ['phrygian', 0.4]],
    kick: [FOUR, FOUR, 'x.....x...x.....', 'x..x......x.....'], backbeat: [['clap', BACKBEAT], ['snare', BACKBEAT]], hatClosed: ['xxxxxxxxxxxxxxxx', 'x.xxx.xxx.xxx.xx'], hatOpen: [OFFBEAT, '................'],
    perc: [['rim', '..x..x..x..x..x.'], [null, '']],
    chordStyle: ['stab', 'organ'], chordRhythm: ['x.......x.......', '..x...x...x...x.', 'x..x....x..x....'], pad: 0.3,
    bassStyle: ['electro'], bass: ['1.1.8.1.1.1.8.11', '11.1.1.811.1.1.8', '1.8.1.8.1.8.1.8.', '1-.11-.11-.11-.8'],
    lead: [['squareLead', 0.6], ['acid', 0.4]], leadDensity: 0.4, riser: true,
  },
  pop: {
    label: 'Pop', slug: 'pop', form: 'song', kit: 'pop', bpm: [96, 122], swing: [0, 0.04], sidechain: 0.15,
    scales: [['major', 0.7], ['minor', 0.3]],
    kick: ['x.......x.x.....', 'x.....x.x.......', FOUR], backbeat: [['clap', BACKBEAT], ['snare', BACKBEAT]], hatClosed: ['x.x.x.x.x.x.x.x.', 'xoxoxoxoxoxoxoxo'], hatOpen: ['..............x.', '................'],
    perc: [['shaker', 'oooooooooooooooo'], [null, '']],
    chordStyle: ['piano'], chordRhythm: ['x.......x.......', 'x..x..x.x..x..x.', 'x...x...x...x...'], pad: 0.8,
    bassStyle: ['pop'], bass: ['1.......1...5...', '1..1....1..1..5.', '1...1...1...1...', '1-----1-5-----8-'],
    lead: [['vocal', 0.6], ['pluck', 0.4]], leadDensity: 0.45, longNotes: true,
  },
  'hip-hop': {
    label: 'Hip-Hop', slug: 'hip-hop', form: 'song', kit: 'boom', bpm: [84, 96], swing: [0.12, 0.22], sidechain: 0,
    scales: [['minor', 0.7], ['dorian', 0.3]],
    kick: ['x.....x...x.....', 'x..x......x..x..', 'x.......x.x.....', 'x.x.......x..x..'], backbeat: [['snare', BACKBEAT]], hatClosed: ['x.x.x.x.x.x.x.x.', 'xoxoxoxoxoxoxoxo', 'xxxxxxxxxxxxxxxx'], hatOpen: ['................'],
    perc: [['rim', '.......x.......x'], [null, '']],
    chordStyle: ['rhodes', 'piano'], chordRhythm: ['x.......x.......', 'x...........x...', 'x.......x...x...'], pad: 0.4,
    bassStyle: ['sub808'], bass: ['1-----.....1-5--', '1-------1-------', '1-----1---8-----', '1--.....1-------'],
    lead: [['bell', 0.4], ['flute', 0.3], [null, 0.3]], leadDensity: 0.25, crackle: true,
  },
  techno: {
    label: 'Techno', slug: 'techno', form: 'club', kit: 'techno', bpm: [126, 136], swing: [0, 0.02], sidechain: 0.1, chordBars: 2,
    scales: [['minor', 0.5], ['phrygian', 0.3], ['dorian', 0.2]], progressions: PROGRESSIONS.hypnotic,
    kick: [FOUR], backbeat: [['clap', BACKBEAT], [null, '']], hatClosed: ['oxoxoxoxoxoxoxox', 'xoxoxoxoxoxoxoxo', 'oooxoooxoooxooox'], hatOpen: [OFFBEAT],
    perc: [['rim', '...x..x....x..x.'], ['ride', 'x.x.x.x.x.x.x.x.'], ['shaker', 'oxoxoxoxoxoxoxox']],
    chordStyle: ['stab'], chordRhythm: ['...x.....x......', '..x.....x..x....', 'x..........x....'], pad: 0.4, chordFx: true,
    bassStyle: ['rumble'], bass: ['..1...1...1...1.', '..1-..1-..1-..1-'],
    lead: [['acid', 0.7], [null, 0.3]], arp: true, leadDensity: 0.3,
  },
  dubstep: {
    label: 'Dubstep', slug: 'dubstep', form: 'club', kit: 'dubstep', bpm: [140, 140], swing: [0, 0], sidechain: 0.2,
    scales: [['minor', 0.6], ['phrygian', 0.4]],
    kick: ['x.........x.....', 'x.....x...x.....', 'x...........x...'],
    backbeat: [['snare', '........x.......']], hatClosed: ['x.x.x.x.x.x.x.x.', '..x...x...x...x.', 'x..xx..xx..xx..x'], hatOpen: ['................'],
    perc: [[null, '']],
    chordStyle: ['pad'], chordRhythm: ['x...............'], pad: 1,
    bassStyle: ['wobble'], bass: ['1-------1-------', '1---1---1-1-1---', '1-------1---8---', '1-----1-----1---'],
    lead: [['pluck', 0.5], ['bell', 0.5]], leadDensity: 0.25, riser: true, wobble: true,
  },
  autre: {
    label: 'Autre', slug: 'autre',
    subgenres: [
      {
        label: 'Trance', form: 'club', kit: 'club', bpm: [136, 140], swing: [0, 0], sidechain: 0.45,
        scales: [['minor', 0.8], ['major', 0.2]],
        kick: [FOUR], backbeat: [['clap', BACKBEAT]], hatClosed: ['x.x.x.x.x.x.x.x.'], hatOpen: [OFFBEAT], perc: [['ride', 'x.x.x.x.x.x.x.x.']],
        chordStyle: ['supersaw'], chordRhythm: ['x---------------'], pad: 1,
        bassStyle: ['offbeat'], bass: ['.111.111.111.111', '.1.1.1.1.1.1.1.1'],
        lead: [['supersaw', 1]], leadDensity: 0.5, arp: true, riser: true,
      },
      {
        label: 'Drum & Bass', form: 'club', kit: 'dnb', bpm: [170, 174], swing: [0, 0], sidechain: 0.15,
        scales: [['minor', 0.8], ['dorian', 0.2]],
        kick: ['x.........x.....', 'x.......x.x.....', 'x.........xx....'], backbeat: [['snare', BACKBEAT]], hatClosed: ['xoxoxoxoxoxoxoxo', 'x.xxx.xxx.xxx.xx'], hatOpen: ['................'], perc: [['ride', 'x.x.x.x.x.x.x.x.'], [null, '']],
        chordStyle: ['pad'], chordRhythm: ['x...............'], pad: 1,
        bassStyle: ['reese'], bass: ['1-------1-------', '1-----1-8-------', '1-------5-------'],
        lead: [['pluck', 0.6], ['bell', 0.4]], leadDensity: 0.3, riser: true,
      },
      {
        label: 'Lo-fi', form: 'song', kit: 'lofi', bpm: [74, 88], swing: [0.18, 0.26], sidechain: 0,
        scales: [['dorian', 0.5], ['major', 0.3], ['minor', 0.2]],
        kick: ['x.....x...x.....', 'x.......x.....x.'], backbeat: [['snare', BACKBEAT]], hatClosed: ['x.x.x.x.x.x.x.x.', 'xox.xox.xox.xox.'], hatOpen: ['................'], perc: [['rim', '.......x........'], [null, '']],
        chordStyle: ['rhodes'], chordRhythm: ['x...............', 'x.......x.......'], pad: 0.5, sevenths: true,
        bassStyle: ['soft'], bass: ['1-------5-------', '1-----1-----5---', '1-------1---8---'],
        lead: [['bell', 0.6], [null, 0.4]], leadDensity: 0.2, crackle: true,
      },
      {
        label: 'Afro House', form: 'club', kit: 'club', bpm: [118, 124], swing: [0.03, 0.08], sidechain: 0.25,
        scales: [['minor', 0.5], ['dorian', 0.5]],
        kick: [FOUR], backbeat: [['clap', BACKBEAT], [null, '']], hatClosed: ['xoxoxoxoxoxoxoxo'], hatOpen: [OFFBEAT],
        perc: [['conga', 'x..x..x...x..x..'], ['conga', '..x..x..x..x.x..'], ['tom', 'x..x...x..x.....']],
        chordStyle: ['rhodes', 'stab'], chordRhythm: ['..x..x....x..x..', 'x..x..x...x.....'], pad: 0.5,
        bassStyle: ['house'], bass: ['1..1....1..8....', '1.....1...1.5...'],
        lead: [['flute', 0.6], ['bell', 0.4]], leadDensity: 0.3, extraPerc: true,
      },
      {
        label: 'Reggaeton', form: 'song', kit: 'pop', bpm: [90, 98], swing: [0, 0], sidechain: 0.15,
        scales: [['minor', 0.8], ['major', 0.2]],
        kick: [FOUR], backbeat: [['snare', '...x..x....x..x.']], hatClosed: ['x.x.x.x.x.x.x.x.'], hatOpen: ['................'], perc: [['rim', '...x..x....x..x.']],
        chordStyle: ['pluck', 'piano'], chordRhythm: ['x..x..x.x..x..x.', 'x.......x.......'], pad: 0.5,
        bassStyle: ['sub808'], bass: ['1..1..1.1..1..1.', '1-----1-1-----1-'],
        lead: [['pluck', 0.6], ['flute', 0.4]], leadDensity: 0.4,
      },
      {
        label: 'Synthwave', form: 'song', kit: 'pop', bpm: [98, 112], swing: [0, 0], sidechain: 0.2,
        scales: [['minor', 0.7], ['major', 0.3]],
        kick: ['x.......x.......', FOUR], backbeat: [['snare', BACKBEAT]], hatClosed: ['x.x.x.x.x.x.x.x.'], hatOpen: ['................'], perc: [[null, '']],
        chordStyle: ['pad'], chordRhythm: ['x...............'], pad: 1,
        bassStyle: ['offbeat'], bass: ['1.8.1.8.1.8.1.8.', '1111111111111111'],
        lead: [['squareLead', 1]], leadDensity: 0.4, arp: true, longNotes: true,
      },
    ],
  },
};

/* ----------------------------------------------------------------------------
 * Utilitaires musicaux.
 * -------------------------------------------------------------------------- */
function weighted(rng, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function degreeToMidi(base, scale, degree) {
  const octave = Math.floor(degree / 7);
  const index = ((degree % 7) + 7) % 7;
  return base + octave * 12 + scale[index];
}

/** Grille de 16 pas → liste de { step, velocity }. */
function hits(pattern) {
  const out = [];
  for (let step = 0; step < Math.min(16, pattern.length); step++) {
    const char = pattern[step];
    if (char === 'x') out.push({ step, velocity: 1 });
    else if (char === 'o') out.push({ step, velocity: 0.55 });
    else if (char === 'X') out.push({ step, velocity: 1.15 });
  }
  return out;
}

/** Motif de basse → notes { step, length, interval } (interval en degrés de gamme). */
function bassNotes(pattern) {
  const intervals = { 1: 0, 3: 2, 5: 4, 7: 6, 8: 7 };
  const notes = [];
  for (let step = 0; step < 16; step++) {
    const char = pattern[step];
    if (!(char in intervals)) continue;
    let length = 1;
    while (step + length < 16 && pattern[step + length] === '-') length++;
    notes.push({ step, length, interval: intervals[char] });
  }
  return notes;
}

/** Arrangement DJ : intro et outro de 8 mesures, puis alternance build / drop / break. */
function arrangement(bars) {
  const sections = [['intro', 8]];
  let rest = bars - 16;
  const groove = rest >= 40 ? 8 : 4;
  sections.push(['groove', groove]);
  rest -= groove;
  while (rest > 0) {
    const build = rest >= 32 ? 8 : 4;
    sections.push(['build', Math.min(build, rest)]);
    rest -= build;
    if (rest <= 0) break;
    const drop = Math.min(rest >= 24 ? 16 : 8, rest);
    sections.push(['drop', drop]);
    rest -= drop;
    if (rest <= 0) break;
    if (rest < 12) {
      sections[sections.length - 1][1] += rest;
      rest = 0;
      break;
    }
    const pause = rest >= 24 ? 8 : 4;
    sections.push(['break', pause]);
    rest -= pause;
  }
  sections.push(['outro', 8]);
  const perBar = [];
  for (const [name, length] of sections) {
    for (let index = 0; index < length; index++) perBar.push({ name, index, length });
  }
  return { sections, perBar };
}

/** Rôle de chaque couche selon la section (forme « club » ou « song »). */
function layers(section, style) {
  const { name, index, length } = section;
  const last = index === length - 1;
  const club = style.form === 'club';
  switch (name) {
    case 'intro':
      return { kick: club || index >= 4, backbeat: !club || index >= 4, hats: true, hatOpen: index >= 4, perc: index >= 4, bass: false, chords: !club, chordFilter: 0.5, pad: !club && style.pad >= 0.5, lead: false, arp: false };
    case 'groove':
      return { kick: true, backbeat: true, hats: true, hatOpen: true, perc: true, bass: true, chords: true, chordFilter: club ? 0.55 : 0.85, pad: false, lead: !club && index >= length / 2, arp: style.arp, arpFilter: 0.5 };
    case 'build': {
      const progress = (index + 1) / length;
      const rolling = club && index >= length - Math.max(2, length / 2);
      return { kick: !club || index < length - 1, backbeat: !rolling, hats: true, hatOpen: !club, perc: true, bass: !club || index < length / 2, chords: true, chordFilter: club ? 0.5 + 0.5 * progress : 0.9, pad: false, lead: index >= length / 2, arp: style.arp, arpFilter: 0.4 + 0.6 * progress, roll: rolling, rollProgress: progress, riser: club && index === 0 && style.riser !== false };
    }
    case 'drop':
      return { kick: true, backbeat: true, hats: true, hatOpen: true, perc: true, bass: true, chords: true, chordFilter: 1, pad: style.pad >= 1 && club, lead: true, arp: style.arp, arpFilter: 1, crash: index === 0, fill: club && index % 8 === 7, wobble: style.wobble };
    case 'break':
      return { kick: !club, backbeat: !club && index >= length / 2, hats: !club, hatOpen: false, perc: false, bass: false, chords: !club, chordFilter: 0.7, pad: true, lead: true, arp: false, crash: index === 0 };
    default:
      return { kick: true, backbeat: true, hats: true, hatOpen: index < length / 2, perc: true, bass: index < length / 2, chords: false, chordFilter: 0.5, pad: false, lead: false, arp: false, last };
  }
}

/** Mélodie d'une phrase (une mesure par accord) : motif rythmique répété, notes attirées par l'accord. */
function makeMelody(rng, chordDegrees, density, longNotes) {
  const makeRhythm = () => {
    const steps = [];
    for (let step = 0; step < 16; step++) {
      const weight = step % 4 === 0 ? 1 : step % 2 === 0 ? 0.6 : 0.3;
      if (rng.next() < density * weight * 1.6) steps.push(step);
    }
    if (steps.length < 2) steps.push(0, 8);
    return [...new Set(steps)].sort((a, b) => a - b);
  };
  const motif = makeRhythm();
  const notes = [];
  let previous = chordDegrees[0] + 7;
  chordDegrees.forEach((root, bar) => {
    const rhythm = bar % 2 === 0 || rng.chance(0.35) ? motif : makeRhythm();
    rhythm.forEach((step, position) => {
      const next = rhythm[position + 1] ?? 16;
      const strong = step % 4 === 0;
      const chordTones = [root, root + 2, root + 4, root + 7, root + 9];
      const candidates = strong ? chordTones : [previous - 1, previous + 1, previous - 2, previous + 2, ...chordTones];
      const scored = candidates
        .filter((degree) => degree >= 2 && degree <= 13)
        .map((degree) => ({ degree, score: Math.abs(degree - previous) + rng.next() * 2.5 }))
        .sort((a, b) => a.score - b.score);
      const degree = scored.length ? scored[0].degree : previous;
      previous = degree;
      notes.push({ bar, step, length: Math.min(next - step, longNotes ? 8 : 3), degree });
    });
  });
  return notes;
}

/* ----------------------------------------------------------------------------
 * Batterie : sons calculés une fois par morceau puis réutilisés.
 * -------------------------------------------------------------------------- */
function buildKit(rng, kind) {
  const presets = {
    club: { kick: { start: rng.range(130, 165), end: rng.range(45, 52), decay: rng.range(0.28, 0.38), click: 0.25, drive: 1.8 }, snare: { tone: 190, decay: 0.15 }, clap: { decay: 0.13 } },
    electro: { kick: { start: 180, end: rng.range(46, 52), decay: 0.32, click: 0.4, drive: 2.6 }, snare: { tone: 200, decay: 0.14, cutoff: 2200 }, clap: { decay: 0.12, cutoff: 1500 } },
    pop: { kick: { start: 140, end: 50, decay: 0.3, click: 0.2, drive: 1.6 }, snare: { tone: 185, decay: 0.2, noise: 0.9 }, clap: { decay: 0.16 } },
    boom: { kick: { start: 120, end: 50, decay: 0.32, pitchDecay: 0.03, click: 0.35, drive: 2.5 }, snare: { tone: 180, decay: 0.2, noise: 0.95, cutoff: 1500 }, clap: { decay: 0.14 } },
    techno: { kick: { start: 160, end: rng.range(42, 48), decay: rng.range(0.35, 0.45), click: 0.3, drive: 2.8 }, snare: { tone: 210, decay: 0.12 }, clap: { decay: 0.18, cutoff: 1100 } },
    dubstep: { kick: { start: 150, end: 46, decay: 0.4, click: 0.35, drive: 2.5 }, snare: { tone: 200, decay: 0.28, noise: 1, cutoff: 1300 }, clap: { decay: 0.2 } },
    dnb: { kick: { start: 160, end: 52, decay: 0.24, click: 0.4, drive: 2 }, snare: { tone: 220, decay: 0.16, noise: 0.9, cutoff: 1800 }, clap: { decay: 0.12 } },
    lofi: { kick: { start: 110, end: 50, decay: 0.28, click: 0.1, drive: 1.3 }, snare: { tone: 175, decay: 0.15, noise: 0.6, cutoff: 1200 }, clap: { decay: 0.12 } },
  }[kind];
  return {
    kick: kick({ ...presets.kick, rng }),
    snare: snare({ ...presets.snare, rng }),
    clap: clap({ ...presets.clap, rng }),
    hatClosed: noiseHit({ decay: kind === 'lofi' ? 0.03 : 0.035, cutoff: kind === 'lofi' ? 6000 : 7500, rng }),
    hatOpen: noiseHit({ decay: 0.22, cutoff: 6500, rng }),
    ride: noiseHit({ decay: 0.45, cutoff: 5200, q: 2.5, type: 'band', rng }),
    shaker: noiseHit({ decay: 0.05, cutoff: 6000, q: 1.5, type: 'band', rng }),
    rim: tonalHit({ freq: 820, drop: 1.1, decay: 0.03, noise: 0.5, rng }),
    conga: tonalHit({ freq: rng.range(190, 240), drop: 1.25, decay: 0.16, noise: 0.15, rng }),
    tom: tonalHit({ freq: rng.range(120, 150), drop: 1.4, decay: 0.22, noise: 0.1, rng }),
    crash: noiseHit({ decay: 1.1, cutoff: 5000, length: 3, rng }),
  };
}

const PERC_GAIN = { shaker: 0.22, rim: 0.3, conga: 0.35, tom: 0.32, ride: 0.12 };
const PERC_PAN = { shaker: 0.35, rim: -0.25, conga: -0.3, tom: 0.3, ride: 0.2 };

/** Craquements de vinyle et souffle pour le hip-hop et le lo-fi. */
function crackle(seconds, rng) {
  const out = new Float32Array(Math.ceil(seconds * SR));
  let lowpassed = 0;
  for (let i = 0; i < out.length; i++) {
    lowpassed += (rng.next() * 2 - 1 - lowpassed) * 0.05;
    out[i] = lowpassed * 0.06 + (rng.next() < 0.0004 ? (rng.next() * 2 - 1) * 0.5 : 0);
  }
  return out;
}

/* ----------------------------------------------------------------------------
 * Titres.
 * -------------------------------------------------------------------------- */
const ADJECTIVES = ['Midnight', 'Neon', 'Golden', 'Electric', 'Velvet', 'Cosmic', 'Hidden', 'Urban', 'Crystal', 'Solar', 'Lunar', 'Wild', 'Silent', 'Endless', 'Deep', 'Infinite', 'Burning', 'Frozen', 'Paper', 'Digital', 'Tropical', 'Northern', 'Liquid', 'Savage', 'Smooth', 'Broken', 'Rising', 'Lost', 'Secret', 'Magnetic', 'Purple', 'Crimson', 'Atomic', 'Dusty', 'Sunny', 'Stellar'];
const NOUNS = ['Groove', 'Pulse', 'Dreams', 'Lights', 'Motion', 'Horizon', 'Echo', 'Signal', 'Paradise', 'Avenue', 'Rhythm', 'Fever', 'Skyline', 'Shadows', 'Waves', 'Machine', 'Heart', 'Garden', 'District', 'Voltage', 'Mirage', 'Tide', 'Orbit', 'Riddim', 'Sunset', 'Highway', 'Ritual', 'Frequency', 'Memory', 'Fire', 'Club', 'Coast', 'Nights', 'Rooftop', 'Drive', 'Spirit'];

export function makeTitle(rng, used) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const title = `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`;
    if (!used.has(title)) {
      used.add(title);
      return title;
    }
  }
  return `Track ${used.size + 1}`;
}

/* ----------------------------------------------------------------------------
 * Composition d'un morceau.
 * -------------------------------------------------------------------------- */
export function composeTrack({ genreKey, seed, targetSeconds = 90 }) {
  const rng = createRng(seed);
  const genre = GENRES[genreKey];
  const style = genre.subgenres ? rng.pick(genre.subgenres) : genre;
  const bpm = rng.int(style.bpm[0], style.bpm[1]);
  const scaleName = weighted(rng, style.scales);
  const scale = SCALES[scaleName];
  const rootPc = rng.int(0, 11);
  const isMajor = scaleName === 'major';
  const progression = rng.pick(style.progressions ?? (isMajor ? PROGRESSIONS.major : PROGRESSIONS.minor));
  const chordBars = style.chordBars ?? 1;
  const swing = rng.range(style.swing[0], style.swing[1]);

  const barSeconds = 240 / bpm;
  const stepSeconds = barSeconds / 16;
  const bars = Math.min(64, Math.max(32, Math.round(targetSeconds / barSeconds / 8) * 8));
  const song = new Song(bars * barSeconds + 0.5);
  const { sections, perBar } = arrangement(bars);

  const bassBase = 28 + ((rootPc - 4 + 12) % 12);
  const chordBase = 55 + ((rootPc - 7 + 12) % 12);
  const leadBase = chordBase + 12;
  const kit = buildKit(rng, style.kit);

  const kickPattern = hits(rng.pick(style.kick));
  const [backbeatSound, backbeatPattern] = rng.pick(style.backbeat);
  const backbeat = backbeatSound ? hits(backbeatPattern) : [];
  const hatClosed = hits(rng.pick(style.hatClosed));
  const hatOpen = hits(rng.pick(style.hatOpen));
  const [percSound, percPattern] = rng.pick(style.perc);
  const perc = percSound ? hits(percPattern) : [];
  const extraPerc = style.extraPerc ? hits('..x..x..x..x.x..') : [];
  const chordStyle = rng.pick(style.chordStyle);
  const chordRhythmRaw = rng.pick(style.chordRhythm);
  const chordSteps = [...chordRhythmRaw].flatMap((char, step) => (char === 'x' ? [step] : []));
  const sustainedChords = ['piano', 'rhodes', 'supersaw', 'pad'].includes(chordStyle);
  const bassStyle = rng.pick(style.bassStyle);
  const bassPattern = bassNotes(rng.pick(style.bass));
  const leadPreset = weighted(rng, style.lead);
  const usePad = rng.next() < style.pad;
  const sevenths = style.sevenths || rng.chance(0.35);
  const wobbleRates = [1, 2, 3, 4, 0.5].map((multiple) => (bpm / 60) * multiple);

  const phraseDegrees = [];
  for (let bar = 0; bar < progression.length * chordBars; bar++) phraseDegrees.push(progression[Math.floor(bar / chordBars) % progression.length]);
  const melody = makeMelody(rng, phraseDegrees, style.leadDensity, style.longNotes);
  const arpShape = rng.pick([[0, 1, 2, 1], [0, 1, 2, 3], [0, 2, 1, 2], [0, 1, 2, 4], [0, 2, 3, 1]]);

  const timeOf = (bar, step) => bar * barSeconds + step * stepSeconds + (step % 2 === 1 ? swing * stepSeconds : 0);
  const chordMidis = (degree) => {
    const tones = [degree, degree + 2, degree + 4];
    if (sevenths) tones.push(degree + 6);
    return tones.map((tone) => {
      let midi = degreeToMidi(chordBase, scale, tone);
      if (midi > chordBase + 16) midi -= 12;
      return midi;
    }).sort((a, b) => a - b);
  };
  const bassMidi = (degree, interval) => {
    let midi = degreeToMidi(bassBase, scale, (degree % 7) + interval);
    while (midi > bassBase + 12) midi -= 12;
    return midi;
  };

  let previousBass = null;
  for (let bar = 0; bar < bars; bar++) {
    const section = perBar[bar];
    const on = layers(section, style);
    const phraseBar = bar % phraseDegrees.length;
    const degree = phraseDegrees[phraseBar];
    const barStart = bar * barSeconds;

    // --- Batterie ---
    if (on.kick) {
      for (const hit of kickPattern) {
        const time = timeOf(bar, hit.step);
        song.add('drums', time, kit.kick, { gain: 0.95 * hit.velocity });
        song.kickTimes.push(time);
      }
    }
    if (on.backbeat) {
      for (const hit of backbeat) song.add('drums', timeOf(bar, hit.step), kit[backbeatSound], { gain: 0.55 * hit.velocity, reverb: 0.25 });
    }
    if (on.hats) {
      for (const hit of hatClosed) song.add('drums', timeOf(bar, hit.step), kit.hatClosed, { gain: 0.2 * hit.velocity * (0.85 + rng.next() * 0.3), pan: 0.15 });
    }
    if (on.hatOpen) {
      for (const hit of hatOpen) song.add('drums', timeOf(bar, hit.step), kit.hatOpen, { gain: 0.16 * hit.velocity, pan: -0.15 });
    }
    if (on.perc) {
      for (const hit of perc) song.add('drums', timeOf(bar, hit.step), kit[percSound], { gain: PERC_GAIN[percSound] * hit.velocity, pan: PERC_PAN[percSound], reverb: 0.1 });
      for (const hit of extraPerc) song.add('drums', timeOf(bar, hit.step), kit.tom, { gain: 0.25, pan: 0.4 });
    }
    if (on.fill) {
      for (const step of [12, 13, 14, 15]) song.add('drums', timeOf(bar, step), kit.snare, { gain: 0.3 + (step - 12) * 0.08, reverb: 0.2 });
    }
    if (on.roll) {
      const division = on.rollProgress > 0.75 ? 1 : 2;
      for (let step = 0; step < 16; step += division) song.add('drums', timeOf(bar, step), kit.snare, { gain: 0.15 + 0.35 * on.rollProgress * (step / 16 + 0.5), reverb: 0.3 });
    }
    if (on.crash) song.add('drums', barStart, kit.crash, { gain: 0.3, reverb: 0.3 });
    if (on.riser) {
      const length = section.length * barSeconds;
      song.add('music', barStart, riser({ seconds: length, rng }), { gain: 0.3, reverb: 0.3 });
    }

    // --- Basse ---
    if (on.bass) {
      const wobble = bassStyle === 'wobble';
      for (const note of bassPattern) {
        const midi = bassMidi(degree, note.interval);
        const time = timeOf(bar, note.step);
        const sustained = note.length > 1;
        const dur = note.length * stepSeconds * (sustained ? 0.98 : 0.7);
        let params;
        if (wobble && !on.wobble) params = BASS.soft(midiToFreq(midi), dur, {});
        else params = BASS[bassStyle](midiToFreq(midi), dur, { glideFrom: previousBass && rng.chance(0.3) ? midiToFreq(previousBass) : undefined, lfoRate: rng.pick(wobbleRates) });
        song.add('music', time, synth(params).left, { gain: bassStyle === 'rumble' ? 0.32 : 0.48 });
        previousBass = midi;
      }
    }

    // --- Accords ---
    const filterScale = (value) => Math.pow(2, (value - 1) * 3);
    const singleHit = chordSteps.length === 1;
    if (on.chords && (!singleHit || bar % chordBars === 0)) {
      chordSteps.forEach((step, position) => {
        const next = chordSteps[position + 1] ?? 16;
        const span = (next - step) * stepSeconds * (singleHit ? chordBars : 1);
        // Accords tenus jusqu'au suivant (piano, pad…) ou courts et rythmiques (stab, pluck, orgue).
        const dur = sustainedChords ? span * 0.95 : Math.min(span, 2 * stepSeconds) * 0.6;
        for (const midi of chordMidis(degree)) {
          const params = CHORDS[chordStyle](midiToFreq(midi), dur);
          params.cutoff = (params.cutoff ?? 20000) * filterScale(on.chordFilter);
          const sound = synth(params);
          song.add('music', timeOf(bar, step), sound, { gain: (chordStyle === 'supersaw' ? 0.13 : 0.15) * (style.chordFx ? 0.9 : 1), pan: params.stereo ? 0 : ((midi % 3) - 1) * 0.25, reverb: style.chordFx ? 0.5 : 0.22, delay: style.chordFx ? 0.35 : 0.05 });
        }
      });
    }
    if ((on.pad || (usePad && on.chords && section.name !== 'groove')) && bar % chordBars === 0) {
      for (const midi of chordMidis(degree)) {
        const params = CHORDS.pad(midiToFreq(midi), barSeconds * chordBars * 0.98);
        params.cutoff *= filterScale(Math.min(1, on.chordFilter + 0.15));
        song.add('music', barStart, synth(params), { gain: 0.09, reverb: 0.4 });
      }
    }

    // --- Arpège ---
    if (on.arp) {
      const tones = chordMidis(degree);
      const ladder = [...tones, tones[0] + 12, tones[1] + 12];
      for (let step = 0; step < 16; step++) {
        const midi = ladder[arpShape[step % arpShape.length] % ladder.length] + 12;
        const params = (style.kit === 'techno' ? LEADS.acid : LEADS.pluck)(midiToFreq(midi), stepSeconds * 0.8);
        params.cutoff *= filterScale(on.arpFilter ?? 1) * (style.kit === 'techno' ? 1 + Math.sin(bar / 2 + step / 8) * 0.6 : 1);
        song.add('music', timeOf(bar, step), synth(params).left, { gain: 0.1, pan: step % 2 ? 0.3 : -0.3, delay: 0.25, reverb: 0.15 });
      }
    }

    // --- Mélodie ---
    if (on.lead && leadPreset) {
      for (const note of melody.filter((item) => item.bar === phraseBar)) {
        const variation = section.name === 'drop' && section.index >= 8 && note.step % 8 === 4 ? 2 : 0;
        const midi = degreeToMidi(leadBase, scale, note.degree + variation - 7);
        const dur = note.length * stepSeconds * 0.92;
        const params = LEADS[leadPreset](midiToFreq(midi), dur);
        if (section.name === 'build') params.cutoff = (params.cutoff ?? 20000) * filterScale(0.6 + 0.4 * (section.index + 1) / section.length);
        song.add('music', timeOf(bar, note.step), synth(params), { gain: leadPreset === 'supersaw' ? 0.12 : 0.17, pan: 0.05, delay: 0.22, reverb: 0.25 });
      }
    }
  }

  if (style.crackle) song.add('drums', 0, crackle(bars * barSeconds, rng), { gain: 1 });

  const audio = song.render({
    sidechain: style.sidechain,
    delayTime: stepSeconds * 3,
    reverbSize: style.form === 'song' ? 0.8 : 0.84,
    drive: style.kit === 'lofi' ? 1.2 : 1.7,
  });

  return {
    audio,
    meta: {
      genre: genre.label,
      subgenre: genre.subgenres ? style.label : null,
      bpm,
      key: `${NOTE_NAMES[rootPc]}${isMajor ? '' : 'm'}`,
      scale: scaleName,
      bars,
      seconds: Math.round((bars * barSeconds + 0.5) * 10) / 10,
      structure: sections.map(([name, length]) => `${name}:${length}`).join(' '),
    },
  };
}
