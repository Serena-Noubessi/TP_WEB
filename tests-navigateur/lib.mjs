/**
 * Outils communs des tests navigateur MOST VIBE.
 *
 * - Chrome est lancé sans fenêtre et TOUJOURS MUET (--mute-audio) : un test ne
 *   doit jamais faire entendre de musique.
 * - Le navigateur est piloté par le protocole DevTools (CDP), sans dépendance.
 * - Configuration par variables d'environnement (valeurs par défaut entre parenthèses) :
 *   WEB_URL (http://localhost:4300), WEB_URL_DOWN (http://localhost:4301, site branché
 *   sur une API absente), API_URL (http://localhost:3001/api), CHROME_PATH, CAPTURES
 *   (tests-navigateur/captures).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BASE = process.env.WEB_URL ?? 'http://localhost:4300';
export const BASE_DOWN = process.env.WEB_URL_DOWN ?? 'http://localhost:4301';
export const API = process.env.API_URL ?? 'http://localhost:3001/api';
export const PASSWORD = 'MotDePasse123';
const CAPTURES = process.env.CAPTURES ?? path.join(HERE, 'captures');
mkdirSync(CAPTURES, { recursive: true });

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) throw new Error('Chrome introuvable : indiquez son chemin dans la variable CHROME_PATH');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(path.join(os.tmpdir(), 'mostvibe-tests-'));
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--mute-audio',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1440,1000',
    // Sous Windows, le rendu par la carte graphique évite les lenteurs et blocages du rendu logiciel.
    ...(process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : []),
    'about:blank',
  ],
  { stdio: 'ignore' },
);
let targets = [];
for (let i = 0; i < 60 && !targets.length; i++) {
  try {
    targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((target) => target.type === 'page');
  } catch {
    /* Chrome démarre encore */
  }
  if (!targets.length) await sleep(250);
}
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((resolve) => (ws.onopen = resolve));

let id = 0;
const pending = new Map();
/** Erreurs JavaScript et console.error de la page (vérifiées à la fin de chaque test). */
export const logs = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (message.params.exceptionDetails.exception?.description ?? '').slice(0, 200));
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    logs.push('error ' + message.params.args.map((arg) => arg.value ?? arg.description).join(' ').slice(0, 200));
  }
};

/** Délai maximal d'une commande à Chrome : un blocage devient un échec signalé, jamais une attente sans fin. */
const COMMAND_TIMEOUT_MS = 30000;
export const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const callId = ++id;
    const timer = setTimeout(() => {
      pending.delete(callId);
      reject(new Error(`Chrome ne répond pas depuis ${COMMAND_TIMEOUT_MS / 1000} s (commande ${method})`));
    }, COMMAND_TIMEOUT_MS);
    pending.set(callId, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    ws.send(JSON.stringify({ id: callId, method, params }));
  });

// Un test qui plante (Chrome bloqué, erreur inattendue) est compté comme un échec, et Chrome est toujours arrêté.
const abort = (error) => {
  console.log(`\n=== BILAN : 0 réussis, 1 échoués\nÉCHEC : test interrompu — ${error?.message ?? error}`);
  chrome.kill();
  process.exit(1);
};
process.on('unhandledRejection', abort);
process.on('uncaughtException', abort);
await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');

/** Évalue une expression JavaScript dans la page et renvoie sa valeur. */
export const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

/** Clic souris réel au centre de l'élément désigné par l'expression JavaScript `expr`. */
export const click = async (expr) => {
  const center = await ev(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!center) {
    console.log('    (élément introuvable :', expr.slice(0, 100), ')');
    return 'INTROUVABLE';
  }
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: center.x, y: center.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  }
  return 'ok';
};

/** Saisie clavier dans le champ `selector` (son contenu est d'abord sélectionné). */
export const type = async (selector, value) => {
  await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); })()`);
  await send('Input.insertText', { text: value });
};

export const key = async (name) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: name, code: name, windowsVirtualKeyCode: name === 'Enter' ? 13 : 0, ...(type === 'keyDown' && name === 'Enter' && { text: '\r' }) });
  }
};

export const shot = async (name, top = true) => {
  if (top) await ev('window.scrollTo(0,0)');
  await sleep(300);
  const result = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(CAPTURES, `${name}.png`), Buffer.from(result.result.data, 'base64'));
};

export const go = async (pagePath, wait = 2500, base = BASE) => {
  await send('Page.navigate', { url: base + pagePath });
  await sleep(wait);
};

/** Navigation interne d'Angular, sans recharger la page (l'état du studio est conservé). */
export const routerGo = async (pagePath, wait = 1500) => {
  await ev(`history.pushState(null, '', ${JSON.stringify(pagePath)}); dispatchEvent(new PopStateEvent('popstate'))`);
  await sleep(wait);
};

export const waitFor = async (expression, timeout = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await ev(expression)) return true;
    await sleep(300);
  }
  return false;
};

export const text = (selector) => ev(`document.querySelector(${JSON.stringify(selector)})?.textContent.replace(/\\s+/g, ' ').trim() ?? null`);

/** Carte de piste (app-track-tile) par titre, en expression JavaScript. */
export const tile = (title) => `[...document.querySelectorAll('app-track-tile')].find(t => t.querySelector('h3')?.textContent.trim() === ${JSON.stringify(title)})`;

/** Appel direct de l'API (préparation et vérifications côté serveur). */
export const api = (apiPath, token, init = {}) =>
  fetch(API + apiPath, { ...init, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(init.body && { 'Content-Type': 'application/json' }), ...init.headers } });

/** Connexion par l'API : { token, user }. */
export const login = async (email, password = PASSWORD) => (await api('/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password }) })).json();

/** Ouvre `pagePath` en tant que `user` (jeton posé dans le navigateur). */
export const as = async (user, pagePath, wait = 3000) => {
  await go('/login', 600);
  await ev(`localStorage.setItem('gpc_token', ${JSON.stringify(user.token)})`);
  await go(pagePath, wait);
};

/** Accès aux comptes de démonstration A, B et C. */
export const accounts = async () => ({
  A: await login('alice@mostvibe.test'),
  B: await login('bob@mostvibe.test'),
  C: await login('chloe@mostvibe.test'),
});

const results = [];
/** Vérification : affichée tout de suite, puis comptée dans le bilan. */
export const check = (label, ok, detail = '') => {
  results.push({ ok: Boolean(ok), label, detail: String(detail ?? '') });
  console.log(ok ? '  ✔' : '  ✘', label, detail ? `— ${String(detail).slice(0, 240)}` : '');
};

/** Vérifie l'absence d'erreur JavaScript, affiche le bilan, ferme Chrome. Code de sortie 1 en cas d'échec. */
export const finish = async (ignore = /status of 40[1349]/) => {
  const relevant = logs.filter((line) => !ignore.test(line));
  check('aucune erreur JavaScript dans la page', relevant.length === 0, relevant.slice(0, 5).join(' || '));
  const failed = results.filter((result) => !result.ok);
  console.log(`\n=== BILAN : ${results.length - failed.length} réussis, ${failed.length} échoués`);
  for (const result of failed) console.log('ÉCHEC :', result.label, result.detail.slice(0, 240));
  ws.close();
  chrome.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* profil encore verrouillé par Chrome : sans importance */
  }
  process.exit(failed.length ? 1 : 0);
};
