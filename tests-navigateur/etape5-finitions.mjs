/**
 * Test navigateur MOST VIBE — Étape 5 (section 11) : états vides utiles (compte neuf),
 * erreurs claires quand l'API ne répond pas, session expirée, messages de connexion.
 * Utilise deux sites : WEB_URL (API de démo) et WEB_URL_DOWN (API volontairement absente).
 * Chrome sans fenêtre et muet (voir lib.mjs). Lancement : node tests-navigateur/run-all.mjs
 */
import { api, BASE, BASE_DOWN, check, ev, finish, go, login, shot, sleep, text, type } from './lib.mjs';

const main = async () => ((await ev(`document.querySelector('main')?.innerText`)) ?? '').replace(/\s+/g, ' ');
await api('/auth/register', null, { method: 'POST', body: JSON.stringify({ name: 'Temp Vide', email: 'temp-empty@mostvibe.test', password: 'MotDePasse123' }) });
const T = await login('temp-empty@mostvibe.test');
const A = await login('alice@mostvibe.test');
const asOn = async (base, user, pagePath, wait = 4500) => {
  await go('/login', 800, base);
  await ev(`localStorage.setItem('gpc_token', ${JSON.stringify(user.token)})`);
  await go(pagePath, wait, base);
};

console.log('=== 1. ÉTATS VIDES UTILES (compte neuf, sans contenu)');
const EMPTY = [
  ['/library', /aucune piste/i],
  ['/library?tab=albums', /Aucun album/],
  ['/library?tab=playlists', /Aucune playlist/],
  ['/library?tab=favorites', /Aucun favori/],
  ['/library?tab=shared', /Personne n’a encore partagé/],
  ['/library?tab=mixes', /Aucun projet/],
  ['/tracks', /importez un fichier/],
  ['/audio', /importez-en depuis l’onglet Backing tracks/],
  ['/friends', /pas encore d’amis/],
  ['/friends?tab=invitations', /Aucune invitation reçue/],
  ['/messages', /Aucune conversation/],
];
for (const [pagePath, expected] of EMPTY) {
  await asOn(BASE, T, pagePath);
  const content = await main();
  check(`${pagePath} : état vide qui dit quoi faire`, expected.test(content) && !/Chargement/.test(content), content.slice(-160));
}

console.log('=== 2. API INJOIGNABLE : ERREUR CLAIRE, JAMAIS DE « CHARGEMENT » SANS FIN');
for (const pagePath of ['/', '/explore', '/library', '/tracks', '/audio', '/mix', '/friends', '/messages', '/settings', '/admin']) {
  await asOn(BASE_DOWN, A, pagePath, 5000);
  const content = await main();
  check(`${pagePath} : message « le serveur ne répond pas »`, /ne répond pas/.test(content) && !/Chargement/.test(content), content.slice(0, 160));
}
await asOn(BASE_DOWN, A, '/library', 5000);
const tabs = await ev(`[...document.querySelectorAll('.tab')].map(t => t.textContent.trim()).join(' | ')`);
check('bibliothèque : pas de compteur « 0 » trompeur pendant une panne', !/\d/.test(tabs), tabs);
await shot('etape5-api-injoignable');
await ev(`localStorage.removeItem('gpc_token')`);
await go('/login', 1500, BASE_DOWN);
await type('#login-email', 'alice@mostvibe.test');
await type('#login-password', 'MotDePasse123');
await ev(`document.querySelector('form button[type=submit]').click()`);
await sleep(2500);
check('connexion pendant une panne : « Le serveur ne répond pas… »', /serveur ne répond pas/.test((await text('.error')) ?? ''), await text('.error'));

console.log('=== 3. CONNEXION ET SESSION EXPIRÉE');
await go('/login', 1500);
await type('#login-email', 'alice@mostvibe.test');
await type('#login-password', 'mauvais-mot-de-passe');
await ev(`document.querySelector('form button[type=submit]').click()`);
await sleep(2000);
check('mauvais mot de passe : « Email ou mot de passe incorrect. »', (await text('.error')) === 'Email ou mot de passe incorrect.');
await ev(`localStorage.setItem('gpc_token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.jeton-expire')`);
await go('/library?tab=playlists', 4000);
const url = await ev('location.pathname + location.search');
check('session expirée : retour à la connexion en gardant la page demandée', url.startsWith('/login') && url.includes('reason=expired') && url.includes('returnUrl=%2Flibrary'), url);
check('… avec un bandeau explicatif', /session a expiré/.test((await text('.pending-banner')) ?? ''));
check('… et le jeton invalide effacé', (await ev(`localStorage.getItem('gpc_token')`)) === null);
await shot('etape5-session-expiree');
await type('#login-email', 'alice@mostvibe.test');
await type('#login-password', 'MotDePasse123');
await ev(`document.querySelector('form button[type=submit]').click()`);
await sleep(3500);
check('… reconnexion : retour sur la page demandée', (await ev('location.pathname + location.search')) === '/library?tab=playlists');

await api('/users/me', T.token, { method: 'DELETE', body: JSON.stringify({ password: 'MotDePasse123', confirmation: 'SUPPRIMER' }) });
// L'API est coupée exprès : les messages que l'application journalise alors avec console.error
// (« [HomePage] Accueil indisponible »…) sont attendus. Seuls les vrais plantages (exceptions) comptent.
await finish(/^error /);
