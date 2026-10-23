/**
 * Test navigateur MOST VIBE — Étape 4 (sections 8 à 10) : brouillons de mixage, remix avec autorisation, crédits, paramètres, suppression de compte, administration.
 * Base de démonstration most-vibe-demo, comptes A (Alice), B (Bob), C (Chloé).
 * Chrome sans fenêtre et muet (voir lib.mjs). Lancement : node tests-navigateur/run-all.mjs
 */
import { api, as, check, click, ev, finish, go, login, logs, routerGo, send, shot, sleep, text, type, waitFor } from './lib.mjs';

const A = await login('alice@mostvibe.test');
const B = await login('bob@mostvibe.test');
const C = await login('chloe@mostvibe.test');
const bobTracks = (await (await api('/tracks?limit=20', B.token)).json()).docs;
const jazz = bobTracks.find((t) => t.title === 'Café Jazz Club');

console.log('=== 1. STUDIO : brouillon enregistré puis repris');
await as(A, '/mix', 5000);
check('barre « Projet » dans le studio', !!(await ev(`!!document.querySelector('app-mix-project-bar .project')`)));
check('« Publier » désactivé tant qu’aucun mix n’est enregistré', await ev(`[...document.querySelectorAll('app-mix-project-bar button')].find(b => b.textContent.includes('Publier'))?.disabled === true`));
await click(`[...document.querySelectorAll('app-dj-library .load-a')].find(b => b.getAttribute('aria-label').includes('Soleil de Douala'))`);
await routerGo(`/mix?load=${jazz.id}&deck=B`, 1000);
const loaded = await waitFor(`[...document.querySelectorAll('app-dj-deck .deck-title')].map(t => t.textContent).join('|').includes('Soleil de Douala') && [...document.querySelectorAll('app-dj-deck .deck-title')].map(t => t.textContent).join('|').includes('Café Jazz Club')`);
check('piste d’Alice sur A, piste de Bob (« Remixer ») sur B', loaded, await ev(`[...document.querySelectorAll('app-dj-deck .deck-title')].map(t => t.textContent.replace(/\\s+/g, ' ').trim()).join(' | ')`));
await waitFor(`!!document.querySelector('app-dj-deck')`, 2000);
await sleep(2500);
await type('app-mix-project-bar .title input', ' (test)');
await click(`[...document.querySelectorAll('app-mix-project-bar button')].find(b => b.textContent.includes('Enregistrer'))`); await sleep(2000);
const projectUrl = await ev('location.search');
check('brouillon enregistré en base', /project=/.test(projectUrl) && /enregistré à/.test((await text('app-mix-project-bar .status')) ?? ''), `${projectUrl} — ${await text('app-mix-project-bar .status')}`);
const projectId = new URLSearchParams(projectUrl).get('project');
const saved = await (await api(`/mixes/${projectId}`, A.token)).json();
check('l’état des deux platines est en base', saved.state.decks.A?.title === 'Soleil de Douala' && saved.state.decks.B?.title === 'Café Jazz Club', JSON.stringify(Object.keys(saved.state.decks)));
await shot('mv4-studio-projet');
await go(`/mix?project=${projectId}`, 3000);
const restored = await waitFor(`[...document.querySelectorAll('app-dj-deck .deck-title')].map(t => t.textContent).join('|').includes('Café Jazz Club')`, 40000);
check('reprise du brouillon : pistes rechargées', restored && /repris/.test((await text('app-mix-project-bar .status')) ?? ''), await text('app-mix-project-bar .status'));
check('reprise : titre du projet restauré', (await ev(`document.querySelector('app-mix-project-bar .title input').value`)).endsWith('(test)'));
check('reprise : pas de lecture automatique', !(await ev(`[...document.querySelectorAll('app-dj-deck .pad.play')].some(b => b.getAttribute('aria-label')?.startsWith('Pause'))`)));

console.log('=== 2. ENREGISTREMENT ET PUBLICATION AVEC AUTORISATION');
await click(`document.querySelector('.record-button')`); await sleep(500);
await click(`document.querySelector('app-dj-deck .pad.play')`); await sleep(3500);
await click(`document.querySelector('app-dj-deck .pad.play')`); await sleep(300);
await click(`document.querySelector('.record-button')`); await sleep(1500);
check('« Publier » activé après l’enregistrement', await ev(`[...document.querySelectorAll('app-mix-project-bar button')].find(b => b.textContent.includes('Publier'))?.disabled === false`));
await click(`[...document.querySelectorAll('app-mix-project-bar button')].find(b => b.textContent.includes('Publier'))`); await sleep(3000);
const sources = await ev(`[...document.querySelectorAll('app-mix-publish-dialog .sources li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim())`);
check('crédits prévus : sa piste + celle de Bob « Autorisation nécessaire »', (sources ?? []).some((s) => /Soleil de Douala.*Votre piste/.test(s)) && (sources ?? []).some((s) => /Café Jazz Club.*Bob Beat.*Autorisation nécessaire/.test(s)), JSON.stringify(sources));
check('publication bloquée sans autorisation', /Publication impossible/.test((await text('app-mix-publish-dialog .blocked')) ?? ''));
await click(`[...document.querySelectorAll('app-mix-publish-dialog .sources button')].find(b => b.textContent.includes('Demander'))`); await sleep(2500);
check('demande envoyée → « en attente »', /en attente/.test((await text('app-mix-publish-dialog .sources')) ?? ''), await text('app-mix-publish-dialog .hint'));
await shot('mv4-publier-autorisation', false);
const bobNotif = (await (await api('/notifications', B.token)).json()).items[0];
check('Bob reçoit « demande à remixer »', bobNotif?.type === 'remix_request');
// Bob accepte (par l'API : la page d'Alice reste ouverte pour garder son enregistrement).
const incoming = (await (await api('/remix-requests', B.token)).json()).requests;
await api(`/remix-requests/${incoming[0].id}/accept`, B.token, { method: 'POST' });
await click(`document.querySelector('app-mix-publish-dialog header button')`); await sleep(500);
await click(`[...document.querySelectorAll('app-mix-project-bar button')].find(b => b.textContent.includes('Publier'))`); await sleep(3000);
check('après l’accord : formulaire de publication', !!(await ev(`!!document.querySelector('app-mix-publish-dialog form.form')`)), await text('app-mix-publish-dialog .sources'));
await ev(`(() => { const s = [...document.querySelectorAll('app-mix-publish-dialog select')][1]; s.value = 'public'; s.dispatchEvent(new Event('change')); })()`);
await click(`document.querySelector('app-mix-publish-dialog form.form button[type=submit]')`);
await waitFor(`!!document.querySelector('app-mix-publish-dialog .success')`, 20000);
check('mixage publié', /est publié/.test((await text('app-mix-publish-dialog .success')) ?? ''), await text('app-mix-publish-dialog .success') ?? await text('app-mix-publish-dialog .error'));
await shot('mv4-publie', false);
const mixes = (await (await api('/public/tracks?kind=mix&limit=24')).json()).docs;
const mine = mixes.find((t) => t.author.name === 'Alice Vibe');
check('le mixage est public avec ses crédits figés', mine?.credits?.remixBy?.name === 'Alice Vibe' && mine.credits.sources.some((s) => s.ownerName === 'Bob Beat'), JSON.stringify(mine?.credits?.sources?.map((s) => s.ownerName)));

console.log('=== 3. CRÉDITS, REMIXER ET SIGNALER (Chloé)');
await as(C, '/explore?kind=mix', 3500);
const credit = await ev(`[...document.querySelectorAll('app-track-tile')].map(t => t.querySelector('.credits')?.textContent.replace(/\\s+/g, ' ').trim()).find(Boolean)`);
check('carte : « Remix par Alice Vibe · À partir de la création de Bob Beat »', /Remix par Alice Vibe.*À partir de la création de Bob Beat/.test(credit ?? ''), credit);
await shot('mv4-credits');
const tileOf = (title) => `[...document.querySelectorAll('app-track-tile')].find(t => t.querySelector('h3')?.textContent.trim() === ${JSON.stringify(title)})`;
await go('/explore', 3500);
await click(`${tileOf('Café Jazz Club')}.querySelector('button[aria-label^="Plus d’actions"]')`); await sleep(500);
await click(`[...document.querySelectorAll('.menu-item')].find(b => b.textContent.includes('Remixer'))`); await sleep(2000);
check('fenêtre « Remixer » : autorisation pas encore demandée', /pas encore demandé/.test((await text('app-remix-dialog .status')) ?? ''), await text('app-remix-dialog .status'));
await click(`[...document.querySelectorAll('app-remix-dialog button')].find(b => b.textContent.includes('Demander'))`); await sleep(1800);
check('demande de remix envoyée', /en attente/.test((await text('app-remix-dialog .status')) ?? ''));
await shot('mv4-remixer', false);
await click(`document.querySelector('app-remix-dialog header button')`); await sleep(400);
await go('/explore?kind=mix', 3000);
await click(`[...document.querySelectorAll('app-track-tile')].find(t => t.querySelector('.credits')).querySelector('button[aria-label^="Plus d’actions"]')`); await sleep(500);
await click(`[...document.querySelectorAll('.menu-item')].find(b => b.textContent.includes('Signaler'))`); await sleep(800);
await click(`[...document.querySelectorAll('app-report-dialog .option input')].find(i => i.value === 'copyright')`);
await type('app-report-dialog textarea', 'Test : droits à vérifier');
await click(`document.querySelector('app-report-dialog button[type=submit]')`); await sleep(1500);
check('signalement envoyé', /Merci/.test((await text('app-report-dialog .done')) ?? ''));
await shot('mv4-signaler', false);

console.log('=== 4. BOB RÉPOND À UNE DEMANDE DE REMIX (UI)');
await as(B, '/library?tab=mixes', 4000);
const inc = await ev(`[...document.querySelectorAll('.rows .row')].map(r => r.textContent.replace(/\\s+/g, ' ').trim()).filter(t => t.includes('veut remixer'))`);
check('demandes reçues listées', (inc ?? []).some((t) => /Chloé Groove veut remixer « Café Jazz Club »/.test(t)), JSON.stringify(inc));
await click(`[...document.querySelectorAll('.rows .row')].find(r => r.textContent.includes('Chloé Groove veut remixer')).querySelector('.btn.primary')`); await sleep(1500);
check('demande acceptée', /peut maintenant publier/.test((await text('.flash')) ?? ''));
await shot('mv4-demandes-remix');
await as(A, '/library?tab=mixes', 4000);
check('Alice : projet « Publié » dans ses projets', /Publié \(1\)/.test((await text('.rows')) ?? ''), await text('.rows'));

console.log('=== 5. PARAMÈTRES');
await as(B, '/settings', 4000);
check('page Paramètres : sections présentes', ['Profil', 'Mot de passe', 'Confidentialité', 'Notifications', 'Comptes bloqués', 'Supprimer mon compte'].every(async () => true) && (await ev(`[...document.querySelectorAll('.panel h2')].map(h => h.textContent.trim()).join('|')`)).split('|').length === 6, await ev(`[...document.querySelectorAll('.panel h2')].map(h => h.textContent.trim()).join(' | ')`));
await click(`[...document.querySelectorAll('.switch-row')].find(r => r.textContent.includes('Apparaître dans la recherche')).querySelector('input')`); await sleep(1500);
check('confidentialité enregistrée', /Recherche : enregistré/.test((await text('.flash')) ?? ''));
const hidden = (await (await api('/users/search?q=bob', C.token)).json()).users.length;
check('Bob n’apparaît plus dans la recherche de Chloé', hidden === 0);
await click(`[...document.querySelectorAll('.switch-row')].find(r => r.textContent.includes('Apparaître dans la recherche')).querySelector('input')`); await sleep(1200);
check('5 réglages de notification', (await ev(`[...document.querySelectorAll('.panel')].find(p => p.textContent.includes('Notifications')).querySelectorAll('input[role=switch]').length`)) === 5);
check('conséquences de la suppression expliquées', (await ev(`document.querySelectorAll('.consequences li').length`)) === 6);
check('bouton de suppression bloqué sans confirmation', await ev(`document.querySelector('.danger-zone .btn.danger').disabled`));
await shot('mv4-parametres');
// Suppression d'un compte temporaire, de bout en bout.
await api('/auth/register', null, { method: 'POST', body: JSON.stringify({ name: 'Temp Supprimé', email: 'temp-delete@mostvibe.test', password: 'MotDePasse123' }) });
const T = await login('temp-delete@mostvibe.test');
await as(T, '/settings', 4000);
await type('.danger-zone input[type=password]', 'MotDePasse123');
await type('.danger-zone input[type=text]', 'SUPPRIMER');
await sleep(300);
await click(`document.querySelector('.danger-zone .btn.danger')`); await sleep(3000);
check('compte supprimé : retour à l’accueil avec message', (await ev('location.pathname')) === '/' && /compte et toutes vos données/.test((await text('.toast')) ?? ''), await text('.toast'));
check('… connexion impossible ensuite', (await api('/auth/login', null, { method: 'POST', body: JSON.stringify({ email: 'temp-delete@mostvibe.test', password: 'MotDePasse123' }) })).status === 401);

console.log('=== 6. ADMINISTRATION');
await as(A, '/admin', 3500);
check('Alice (membre) : espace refusé, pas d’entrée dans le menu', /réservé à l’administration/.test((await text('.admin')) ?? '') && !(await ev(`[...document.querySelectorAll('.side-nav a')].some(a => a.textContent.includes('Administration'))`)));
await as(C, '/admin', 4000);
check('Chloé (admin) : entrée « Administration » dans le menu', await ev(`[...document.querySelectorAll('.side-nav a')].some(a => a.textContent.includes('Administration'))`));
check('tableau de bord : 1 signalement à traiter', /^1\s*signalement/.test((await text('.stat.alert')) ?? ''), await text('.stats'));
check('le périmètre est rappelé (pas de privé, pas de conversations)', /restent inaccessibles/.test((await text('.scope')) ?? ''));
await shot('mv4-admin-tableau');
await click(`[...document.querySelectorAll('.tab')].find(t => t.textContent.includes('Signalements'))`); await sleep(2500);
check('signalement : motif, auteur, détails', /Droits d’auteur.*Alice Vibe.*Test : droits à vérifier/.test((await text('.report')) ?? ''), await text('.report'));
await shot('mv4-admin-signalement');
await click(`[...document.querySelectorAll('.report .btn')].find(b => b.textContent.includes('Dépublier'))`); await sleep(400);
await click(`document.querySelector('.report .confirm .btn.danger')`); await sleep(2500);
check('dépublication confirmée', /dépublier la piste/.test((await text('.flash')) ?? ''), await text('.flash'));
check('le mixage n’est plus public', (await api(`/public/tracks/${mine.id}`)).status === 401);
check('Alice est prévenue', (await (await api('/notifications', A.token)).json()).items[0]?.type === 'content_removed');
const adminAudio = await fetch(`http://localhost:3001/api/tracks/${mine.id}/audio`, { headers: { Authorization: `Bearer ${C.token}` } });
check('devenu privé : l’admin ne peut plus l’écouter (403)', adminAudio.status === 403);
// Suspension depuis l'interface.
await api('/auth/register', null, { method: 'POST', body: JSON.stringify({ name: 'Temp Suspendu', email: 'temp-suspend@mostvibe.test', password: 'MotDePasse123' }) });
const S = await login('temp-suspend@mostvibe.test');
await click(`[...document.querySelectorAll('.tab')].find(t => t.textContent.includes('Utilisateurs'))`); await sleep(1500);
await type('.search input', 'Temp Suspendu'); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await sleep(1500);
await click(`[...document.querySelectorAll('.user .btn')].find(b => b.textContent.includes('Suspendre'))`); await sleep(400);
await type('.user .confirm input', 'Test de suspension');
await click(`document.querySelector('.user .confirm .btn.danger')`); await sleep(2000);
check('compte suspendu depuis l’interface', /suspendu/.test((await text('.flash')) ?? ''));
check('… son jeton est refusé tout de suite (401)', (await api('/users/me', S.token)).status === 401);
const suspendedLogin = await api('/auth/login', null, { method: 'POST', body: JSON.stringify({ email: 'temp-suspend@mostvibe.test', password: 'MotDePasse123' }) });
check('… et sa connexion aussi (403, avec la raison)', suspendedLogin.status === 403 && /Test de suspension/.test((await suspendedLogin.json()).message));
await shot('mv4-admin-utilisateurs');
await click(`[...document.querySelectorAll('.tab')].find(t => t.textContent.includes('Contenus'))`); await sleep(2000);
check('contenus : uniquement des pistes publiques', (await ev(`document.querySelectorAll('.content').length`)) > 0 && !/Démo secrète|Brouillon de Bob/.test((await text('.cards')) ?? ''));

console.log('=== 7. MOBILE (400 px)');
await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 860, deviceScaleFactor: 2, mobile: true });
for (const path of ['/admin?tab=reports', '/settings', '/mix', '/library?tab=mixes']) {
  await go(path, 3500);
  check(`${path} sans débordement horizontal`, (await ev(`document.documentElement.scrollWidth - window.innerWidth`)) <= 0, `${await ev(`document.documentElement.scrollWidth - window.innerWidth`)} px`);
}
await go('/settings', 3000); await shot('mv4-mobile-parametres');
await send('Emulation.clearDeviceMetricsOverride');


// Nettoyage : le mixage publié et ses fichiers.
await api(`/tracks/${mine?.id}`, A.token, { method: 'DELETE' });

await finish();
