/**
 * Recette complète MOST VIBE dans le navigateur (section 12).
 *
 *   node tests-navigateur/run-all.mjs            # toutes les étapes
 *   node tests-navigateur/run-all.mjs 3 4        # seulement les étapes 3 et 4
 *   node tests-navigateur/run-all.mjs --seed     # recrée d'abord la base de démonstration
 *
 * Ce que fait ce script :
 * 1. démarre l'API sur la base de DÉMONSTRATION (port 3001), sauf si elle répond déjà ;
 * 2. sert le site compilé sur le port 4300 (API de démo) et sur le port 4301
 *    (API volontairement absente, pour tester les messages d'erreur) ;
 * 3. avant chaque étape, remet la base de démonstration dans son état de départ ;
 * 4. lance chaque étape dans Chrome sans fenêtre et MUET ;
 * 5. écrit le bilan dans tests-navigateur/RESULTATS.md.
 * La vraie base n'est jamais utilisée.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..', 'backend');
const API_PORT = 3001;
const STEPS = [
  { n: 1, file: 'etape1-public.mjs', title: 'Sections 1 à 3 : identité, navigation, pages publiques, recherche, liens directs' },
  { n: 2, file: 'etape2-bibliotheque.mjs', title: 'Sections 4 et 5 : bibliothèque, réactions, action après connexion, visibilité et partage' },
  { n: 3, file: 'etape3-amis-messages.mjs', title: 'Sections 6 et 7 : amis, blocage, fil d’activité, messagerie, cartes musicales' },
  // Le rôle admin ne s'obtient jamais par l'API : on le donne à C avec la commande officielle (base de démonstration).
  { n: 4, file: 'etape4-mix-admin.mjs', title: 'Sections 8 à 10 : mixages et remixes, paramètres, administration', admin: 'chloe@mostvibe.test' },
  { n: 5, file: 'etape5-finitions.mjs', title: 'Section 11 : états vides, erreurs, session expirée, messages de connexion' },
];

const args = process.argv.slice(2);
const only = args.filter((arg) => /^\d$/.test(arg)).map(Number);
const steps = only.length ? STEPS.filter((step) => only.includes(step.n)) : STEPS;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * Lance un programme et attend sa fin SANS bloquer ce processus : le site de test
 * est servi par ce même processus, il doit continuer à répondre au navigateur.
 */
function runAsync(args, options = {}, timeoutMs = 0) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    // Durée maximale d'une étape : au-delà, elle est arrêtée et comptée en échec.
    const timer = timeoutMs
      ? setTimeout(() => {
          const message = `\nÉCHEC : étape arrêtée au bout de ${timeoutMs / 60000} minutes (bloquée)\n`;
          stdout += message;
          process.stdout.write(message);
          child.kill();
        }, timeoutMs)
      : null;
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('close', (status) => {
      if (timer) clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}
const backendScript = async (script, ...scriptArgs) =>
  (await runAsync(['--env-file=.env', `scripts/${script}`, ...scriptArgs], { cwd: BACKEND, env: { ...process.env, MONGODB_DB: 'most-vibe-demo' } })).status === 0;
const apiReady = async () => {
  try {
    return (await fetch(`http://localhost:${API_PORT}/api/health`)).ok;
  } catch {
    return false;
  }
};

let backend = null;
if (!(await apiReady())) {
  console.log('[recette] Démarrage de l’API de démonstration (port 3001)…');
  backend = spawn(process.execPath, ['--env-file=.env', 'scripts/demo-start.mjs'], { cwd: BACKEND, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await apiReady()); i++) await sleep(500);
  if (!(await apiReady())) throw new Error('L’API de démonstration ne répond pas : vérifiez backend/.env (MONGODB_URI) et l’accès réseau à Atlas.');
}
// Les deux sites de test tournent dans des processus SÉPARÉS : servis depuis ce processus,
// ils ralentissaient au point de bloquer Chrome pendant la lecture audio.
const startSite = async (webPort, apiPort) => {
  const site = spawn(process.execPath, [path.join(HERE, 'serveur-test.mjs')], { env: { ...process.env, WEB_PORT: String(webPort), API_PORT: String(apiPort) }, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`http://localhost:${webPort}/`)).ok) return site;
    } catch {
      /* le site démarre encore */
    }
    await sleep(250);
  }
  throw new Error(`Le site de test ne démarre pas sur le port ${webPort} (site compilé ? « npx ng build » dans frontend-starter)`);
};
const servers = [await startSite(4300, API_PORT), await startSite(4301, 3999)];

if (args.includes('--seed')) await backendScript('demo-seed.mjs');
const results = [];
for (const step of steps) {
  console.log(`\n################ Étape ${step.n} — ${step.title}`);
  if (!(await backendScript('demo-reset.mjs'))) throw new Error('Remise à zéro de la base de démonstration impossible');
  if (step.admin && !(await backendScript('set-role.mjs', step.admin, 'admin'))) throw new Error(`Rôle admin impossible à donner à ${step.admin}`);
  const started = Date.now();
  const run = await runAsync([path.join(HERE, step.file)], {}, 10 * 60 * 1000);
  const bilan = /=== BILAN : (\d+) réussis, (\d+) échoués/.exec(run.stdout);
  results.push({
    ...step,
    passed: bilan ? Number(bilan[1]) : 0,
    failed: bilan ? Number(bilan[2]) : 1,
    failures: [...run.stdout.matchAll(/^ÉCHEC : (.*)$/gm)].map((match) => match[1]),
    crashed: !bilan ? (run.stderr || 'arrêt inattendu').split('\n').slice(0, 3).join(' ') : null,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
await backendScript('demo-reset.mjs');
for (const server of servers) server.kill();
backend?.kill();

const total = results.reduce((sum, result) => sum + result.passed, 0);
const failed = results.reduce((sum, result) => sum + result.failed, 0);
const date = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
const lines = [
  '# Résultats de la recette navigateur MOST VIBE',
  '',
  `Dernière exécution : ${date}. Chrome sans fenêtre et muet, base de démonstration \`most-vibe-demo\` (comptes A = Alice, B = Bob, C = Chloé).`,
  '',
  '| Étape | Contenu | Réussis | Échoués | Durée |',
  '|---|---|---|---|---|',
  ...results.map((result) => `| ${result.n} | ${result.title} | ${result.passed} | ${result.failed} | ${result.seconds} s |`),
  `| **Total** | | **${total}** | **${failed}** | |`,
  '',
  ...(failed
    ? ['## Échecs', '', ...results.flatMap((result) => [...result.failures.map((failure) => `- Étape ${result.n} : ${failure}`), ...(result.crashed ? [`- Étape ${result.n} : arrêt inattendu — ${result.crashed}`] : [])])]
    : ['Aucun échec.']),
  '',
  'Relancer : `node tests-navigateur/run-all.mjs` (voir `tests-navigateur/README.md`).',
  '',
];
writeFileSync(path.join(HERE, 'RESULTATS.md'), lines.join('\n'));
console.log(`\n################ RECETTE : ${total} réussis, ${failed} échoués (détail dans tests-navigateur/RESULTATS.md)`);
process.exit(failed ? 1 : 0);
