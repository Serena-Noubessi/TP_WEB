/**
 * Test navigateur MOST VIBE — Étape 2 (sections 4 et 5) : action après connexion, favoris, playlists, « Amis choisis », retrait d'accès, morceaux en ligne en base.
 * Base de démonstration most-vibe-demo, comptes A (Alice), B (Bob), C (Chloé).
 * Chrome sans fenêtre et muet (voir lib.mjs). Lancement : node tests-navigateur/run-all.mjs
 */
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { api, as, check, click, ev, finish, go, login, logs, send, shot, sleep, text, tile, type } from './lib.mjs';

/** Fichier envoyé pendant le test : un morceau généré du dossier musiques-generees/04-pop. */
const POP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'musiques-generees', '04-pop');
const UPLOAD_SAMPLE = path.join(POP, readdirSync(POP).find((file) => file.endsWith('.mp3')));

const A = await login('alice@mostvibe.test');
const B = await login('bob@mostvibe.test');
const C = await login('chloe@mostvibe.test');
const aliceTracks = (await (await api('/tracks?limit=20', A.token)).json()).docs;
const secret = aliceTracks.find((t) => t.title === 'Démo secrète');
const soleil = aliceTracks.find((t) => t.title === 'Soleil de Douala');
// Depuis la section 6, « Amis choisis » exige une amitié : A et B deviennent amis (C reste à l'écart).
const invite = await (await api('/friends/requests', A.token, { method: 'POST', body: JSON.stringify({ userId: B.user.id }) })).json();
if (invite.requestId && invite.status === 'pending') await api(`/friends/requests/${invite.requestId}/accept`, B.token, { method: 'POST' });
// État de départ propre (rejouable).
for (const user of [A, B, C]) for (const t of aliceTracks) for (const kind of ['like', 'favorite']) await api(`/tracks/${t.id}/${kind}`, user.token, { method: 'DELETE' });
await api(`/tracks/${secret.id}`, A.token, { method: 'PATCH', body: JSON.stringify({ visibility: 'private' }) });

console.log('=== 1. VISITEUR : j’aime → connexion → action faite automatiquement');
await go('/', 4000);
const likeCountBefore = await ev(`${tile('Soleil de Douala')}?.querySelector('button.like .count')?.textContent`);
check('la tuile publique a un bouton J’aime avec compteur', likeCountBefore === '0', `compteur=${likeCountBefore}`);
await click(`${tile('Soleil de Douala')}.querySelector('button.like')`); await sleep(1500);
const loginUrl = await ev('location.pathname + location.search');
check('le visiteur est envoyé vers la connexion', loginUrl.startsWith('/login') && loginUrl.includes('reason=action'), loginUrl);
const banner = await ev(`document.querySelector('.pending-banner')?.textContent.trim()`);
check('la page de connexion explique l’action en attente', /aimer « Soleil de Douala »/.test(banner ?? ''), banner);
await shot('mv2-connexion-action');
await type('#login-email', 'alice@mostvibe.test');
await type('#login-password', 'MotDePasse123');
await click(`document.querySelector('form button[type=submit]')`); await sleep(3500);
check('retour à la page d’origine après connexion', (await ev('location.pathname')) === '/', await ev('location.pathname'));
const toast = await ev(`document.querySelector('.toast')?.textContent.trim()`);
check('message « C’est fait »', /C’est fait/.test(toast ?? ''), toast);
const liked = await ev(`${tile('Soleil de Douala')}?.querySelector('button.like')?.getAttribute('aria-pressed')`);
const likeCountAfter = await ev(`${tile('Soleil de Douala')}?.querySelector('button.like .count')?.textContent`);
check('le j’aime est enregistré et affiché', liked === 'true' && likeCountAfter === '1', `pressed=${liked} compteur=${likeCountAfter}`);
const serverReactions = await (await api('/me/reactions', A.token)).json();
check('le j’aime est en base', serverReactions.likes.includes(soleil.id));
await shot('mv2-apres-connexion');

console.log('=== 2. FAVORIS ET PLAYLISTS');
await click(`${tile('Soleil de Douala')}.querySelector('button.favorite')`); await sleep(1200);
check('favori : message bref', /ajouté à vos favoris/.test((await ev(`document.querySelector('.toast')?.textContent`)) ?? ''));
await click(`${tile('Soleil de Douala')}.querySelector('button[aria-haspopup]')`); await sleep(1200);
check('menu playlist ouvert (vide au départ)', /Aucune playlist/.test((await ev(`document.querySelector('.menu')?.textContent`)) ?? ''));
await type('.menu-new input', 'Ma sélection été');
await click(`document.querySelector('.menu-new button')`); await sleep(1800);
check('playlist créée et piste ajoutée depuis la tuile', /Ajouté à « Ma sélection été »/.test((await ev(`document.querySelector('.menu')?.textContent`)) ?? ''));
await go('/library?tab=favorites', 3000);
check('Ma bibliothèque › Favoris', (await ev(`[...document.querySelectorAll('app-track-tile h3')].map(h => h.textContent.trim()).join(',')`)) === 'Soleil de Douala');
await go('/library?tab=playlists', 3000);
await click(`[...document.querySelectorAll('.row .btn')].find(b => b.textContent.trim() === 'Ouvrir')`); await sleep(1500);
check('Playlists : la piste est dans la playlist', /Soleil de Douala/.test((await ev(`document.querySelector('.detail')?.textContent`)) ?? ''));
await shot('mv2-bibliotheque-playlists');

console.log('=== 3. MES FICHIERS ET PARTAGE « AMIS CHOISIS »');
await go('/library', 3500);
const rows = await ev(`[...document.querySelectorAll('.rows .row')].map(r => r.querySelector('strong').textContent.trim() + ':' + r.querySelector('.badge').textContent.trim())`);
check('Mes fichiers liste les pistes d’Alice avec leur visibilité', rows?.length === 5 && rows.includes('Démo secrète:Privé'), JSON.stringify(rows));
await shot('mv2-bibliotheque-fichiers');
await click(`[...document.querySelectorAll('.rows .row')].find(r => r.textContent.includes('Démo secrète')).querySelector('.btn.ghost')`); await sleep(1500);
check('fenêtre « Visibilité et partage » ouverte', !!(await ev(`!!document.querySelector('app-share-dialog [role=dialog]')`)));
check('aucun accès actif au départ', !(await ev(`[...document.querySelectorAll('.grants li button')].some(b => b.textContent.includes('Retirer'))`)), (await ev(`document.querySelector('.grants')?.textContent.replace(/\s+/g, ' ').trim()`)));
await type('app-share-dialog input[type=search]', 'bo');
await sleep(1500);
const found = await ev(`[...document.querySelectorAll('.results li .name')].map(n => n.textContent.trim())`);
check('recherche de profil par nom (sans email)', JSON.stringify(found) === '["Bob Beat"]' || (found ?? []).includes('Bob'), JSON.stringify(found));
await click(`document.querySelector('.results li button')`); await sleep(1800);
const visAfterGrant = await ev(`document.querySelector('.option.selected strong')?.textContent`);
check('donner accès à Bob : la piste passe en « Amis choisis »', visAfterGrant === 'Amis choisis', visAfterGrant);
check('Bob apparaît dans la liste des accès', /Bob/.test((await ev(`document.querySelector('.grants')?.textContent`)) ?? ''));
await shot('mv2-partage-donne', false);
console.log('  Droits côté serveur, lien direct audio :');
const status = async (who) => (await api(`/tracks/${secret.id}/audio`, who?.token)).status;
const sB = await status(B), sC = await status(C), sV = await status(null);
check('Bob (accès donné) 200, Chloé 403, visiteur 401', sB === 200 && sC === 403 && sV === 401, `Bob=${sB} Chloé=${sC} visiteur=${sV}`);
const publicSearch = await (await api('/public/tracks?q=secr%C3%A8te')).json();
check('« Amis choisis » reste absent de la recherche publique', publicSearch.totalDocs === 0);

console.log('  Retrait de l’accès :');
await click(`[...document.querySelectorAll('.grants li button')].find(b => b.textContent.includes('Retirer'))`); await sleep(500);
check('confirmation demandée avant le retrait', !!(await ev(`[...document.querySelectorAll('.grants li button')].some(b => b.textContent.includes('Confirmer'))`)));
await click(`[...document.querySelectorAll('.grants li button')].find(b => b.textContent.includes('Confirmer'))`); await sleep(1800);
const notice = await ev(`document.querySelector('app-share-dialog .notice')?.textContent.trim()`);
check('message : fichier déjà téléchargé non récupérable', /déjà téléchargé ne peut pas être récupéré/.test(notice ?? ''), notice);
check('accès marqué « Retiré » (trace conservée)', /Retiré/.test((await ev(`document.querySelector('.grants')?.textContent`)) ?? ''));
await shot('mv2-partage-retire', false);
const sB2 = await status(B);
check('après retrait, Bob est refusé immédiatement (403)', sB2 === 403, `Bob=${sB2}`);

console.log('  Bob voit la piste dans « Partagés avec moi » pendant son accès :');
await api(`/tracks/${secret.id}/access`, A.token, { method: 'POST', body: JSON.stringify({ userIds: [B.user.id] }) });
await go('/login', 800);
await ev(`localStorage.setItem('gpc_token', ${JSON.stringify(B.token)})`);
await go('/library?tab=shared', 3500);
const sharedTitles = await ev(`[...document.querySelectorAll('.shared-tile h3')].map(h => h.textContent.trim())`);
check('Bob › Partagés avec moi', JSON.stringify(sharedTitles) === '["Démo secrète"]', JSON.stringify(sharedTitles));
check('pochette/lecture : la tuile partagée est lisible', !!(await ev(`!!document.querySelector('.shared-tile button.play')`)));
await click(`document.querySelector('.shared-tile button.play')`); await sleep(3000);
check('Bob écoute la piste partagée dans le lecteur', (await ev(`document.querySelector('.player-bar .now-text strong')?.textContent`)) === 'Démo secrète', await ev(`document.querySelector('.player-bar .status')?.textContent ?? ''`));
await ev(`document.querySelector('.player-bar .play-btn')?.getAttribute('aria-label') === 'Pause' && document.querySelector('.player-bar .play-btn').click()`);
await shot('mv2-bob-partages');
// Alice repasse la piste en Privé : l'accès « Amis choisis » de Bob est retiré.
const back = await (await api(`/tracks/${secret.id}`, A.token, { method: 'PATCH', body: JSON.stringify({ visibility: 'private' }) })).json();
check('repasser en Privé retire les accès choisis', back.revokedAccesses === 1, `retirés=${back.revokedAccesses}`);
await go('/library?tab=shared', 3000);
check('la piste disparaît de « Partagés avec moi » chez Bob', /Personne n’a encore partagé/.test((await ev(`document.querySelector('.panel')?.textContent`)) ?? ''));

console.log('=== 4. ENVOI AVEC « AMIS CHOISIS »');
await go('/login', 800);
await ev(`localStorage.setItem('gpc_token', ${JSON.stringify(A.token)})`);
// Ancienne liste de morceaux en ligne dans le navigateur : doit être reprise en base.
await ev(`localStorage.setItem('gpc_online_tracks_${A.user.id}', JSON.stringify([{ id: 'online-x', title: 'Morceau libre test', originalName: 'libre.mp3', mimeType: 'audio/mpeg', size: 10, createdAt: '', online: { audioUrl: 'https://example.org/libre-test.mp3', artist: 'Test', sourceId: 'url', sourceLabel: 'example.org', pageUrl: null, license: 'CC BY', licenseUrl: null, imageUrl: null, durationSeconds: 30, category: 'house' } }]))`);
await go('/tracks', 4000);
const options = await ev(`[...document.querySelectorAll('.upload-card select')[1].options].map(o => o.textContent.trim() + (o.disabled ? ' (désactivé)' : ''))`);
check('option « Amis choisis » activée à l’envoi', (options ?? []).some((o) => o.startsWith('Amis choisis') && !o.includes('désactivé')), JSON.stringify(options));
const external = (await (await api('/external-tracks', A.token)).json()).docs;
check('morceaux en ligne : ancienne liste du navigateur reprise en base', external.some((t) => t.title === 'Morceau libre test' && t.style === 'electro'), external.map((t) => t.title + '/' + t.style).join(','));
check('… puis effacée du navigateur', (await ev(`localStorage.getItem('gpc_online_tracks_${A.user.id}')`)) === null);
await ev(`(() => { const s = document.querySelectorAll('.upload-card select')[1]; s.value = 'friends'; s.dispatchEvent(new Event('change')); })()`);
await type('.upload-card label input:not([type])', 'Envoi amis test');
const doc = await send('DOM.getDocument');
const node = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '.upload-card input[type=file][accept="audio/*"]' });
const resolved = await send('DOM.resolveNode', { nodeId: node.result.nodeId });
await send('DOM.setFileInputFiles', { objectId: resolved.result.object.objectId, files: [UPLOAD_SAMPLE] });
await sleep(500);
await click(`[...document.querySelectorAll('.upload-card button')].find(b => b.getAttribute('ng-reflect-disabled') !== 'true' && /Envoyer|Importer|Ajouter/.test(b.textContent))`);
for (let i = 0; i < 30 && !(await ev(`!!document.querySelector('app-share-dialog [role=dialog]')`)); i++) await sleep(500);
check('après un envoi « Amis choisis », la fenêtre de partage s’ouvre', !!(await ev(`!!document.querySelector('app-share-dialog [role=dialog]')`)), await ev(`[...document.querySelectorAll('.upload-card [role=status], .upload-card [role=alert]')].map(p => p.textContent.trim()).join(' | ')`));
check('… avec « Amis choisis » sélectionné', (await ev(`document.querySelector('.option.selected strong')?.textContent`)) === 'Amis choisis');
await shot('mv2-envoi-amis', false);
await click(`document.querySelector('app-share-dialog header button')`); await sleep(500);
check('la fenêtre se ferme', !(await ev(`!!document.querySelector('app-share-dialog')`)));

console.log('=== 5. MOBILE (400 px)');
await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 860, deviceScaleFactor: 2, mobile: true });
await go('/library', 3500);
const overflow = await ev(`document.documentElement.scrollWidth - window.innerWidth`);
check('Ma bibliothèque sans débordement horizontal', overflow <= 0, `${overflow} px`);
await shot('mv2-mobile-bibliotheque');
await click(`[...document.querySelectorAll('.rows .row')][0].querySelector('.btn.ghost')`); await sleep(1500);
const dialogOverflow = await ev(`document.documentElement.scrollWidth - window.innerWidth`);
check('fenêtre de partage lisible sur mobile', dialogOverflow <= 0 && !!(await ev(`!!document.querySelector('app-share-dialog [role=dialog]')`)), `${dialogOverflow} px`);
await shot('mv2-mobile-partage', false);
await send('Emulation.clearDeviceMetricsOverride');


// Nettoyage de la base de démonstration (retour à l'état de départ).
const mine = (await (await api('/tracks?limit=20', A.token)).json()).docs;
for (const t of mine.filter((t) => t.title === 'Envoi amis test')) await api(`/tracks/${t.id}`, A.token, { method: 'DELETE' });
for (const p of (await (await api('/playlists', A.token)).json()).playlists) await api(`/playlists/${p.id}`, A.token, { method: 'DELETE' });
for (const t of (await (await api('/external-tracks', A.token)).json()).docs) await api(`/external-tracks/${t.id}`, A.token, { method: 'DELETE' });
for (const kind of ['like', 'favorite']) await api(`/tracks/${soleil.id}/${kind}`, A.token, { method: 'DELETE' });

await finish();
