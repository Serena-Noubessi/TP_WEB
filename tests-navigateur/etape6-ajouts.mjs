/**
 * Test navigateur MOST VIBE — Étape 6 (ajouts du 02/11/2026) : forme d'onde sur les cartes et dans le lecteur,
 * bouton « Télécharger », commentaires selon les droits, abonnement à un artiste, partage d'une playlist.
 * Base de démonstration most-vibe-demo, comptes A (Alice), B (Bob), C (Chloé).
 * Chrome sans fenêtre et muet (voir lib.mjs). Lancement : node tests-navigateur/run-all.mjs 6
 */
import { api, as, check, click, ev, finish, go, login, shot, sleep, text, tile, type, waitFor } from './lib.mjs';

const A = await login('alice@mostvibe.test');
const B = await login('bob@mostvibe.test');
const C = await login('chloe@mostvibe.test');
const aliceTracks = (await (await api('/tracks?limit=20', A.token)).json()).docs;
const soleil = aliceTracks.find((t) => t.title === 'Soleil de Douala');
const secret = aliceTracks.find((t) => t.title === 'Démo secrète');
const main = async () => ((await ev(`document.querySelector('main')?.innerText`)) ?? '').replace(/\s+/g, ' ');
/** Les téléchargements sont interceptés : on note le nom du fichier au lieu de l'enregistrer. */
const spyDownloads = () => ev(`window.__downloads = []; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__downloads.push(this.download); }; true`);

console.log('=== 1. FORME D’ONDE');
check('au départ, les pistes de démonstration n’ont pas de forme d’onde', aliceTracks.every((t) => !t.waveform?.length));
await as(A, '/library', 3000);
const filled = await waitFor(`(async () => (await (await fetch('/api/tracks?limit=20', { headers: { Authorization: 'Bearer ' + localStorage.getItem('gpc_token') } })).json()).docs.every(t => t.waveform?.length === 64))()`, 60000);
check('Ma bibliothèque : le navigateur calcule et enregistre la forme d’onde des 5 pistes d’Alice', filled);
check('… affichée dans chaque ligne de « Mes fichiers »', await ev(`[...document.querySelectorAll('.rows .row app-waveform')].filter(w => w.querySelectorAll('rect:not(.empty)').length === 64).length === 5`));
const stored = (await (await api(`/public/tracks/${soleil.id}`, null)).json()).waveform;
check('… valeurs enregistrées entre 4 et 100, la plus forte à 100', stored?.length === 64 && Math.max(...stored) === 100 && Math.min(...stored) >= 4, JSON.stringify(stored?.slice(0, 8)));
await go('/explore', 3500);
check('Explorer : petite image du son sur la carte', await ev(`${tile('Soleil de Douala')}?.querySelectorAll('app-waveform rect:not(.empty)').length === 64`));
await click(`${tile('Soleil de Douala')}.querySelector('button.play')`);
await waitFor(`document.querySelector('app-player-bar .range.has-wave app-waveform')`, 15000);
check('Lecteur : la forme d’onde remplace la barre de position', await ev(`!!document.querySelector('app-player-bar .range.has-wave app-waveform')`));
await waitFor(`document.querySelectorAll('app-player-bar app-waveform rect.played').length > 0 && document.querySelectorAll('app-player-bar app-waveform rect:not(.played)').length > 0`, 15000);
check('… la partie déjà écoutée est colorée', await ev(`document.querySelectorAll('app-player-bar app-waveform rect.played').length > 0`));
await ev(`(() => { const i = document.querySelector('app-player-bar .range.has-wave input'); i.value = 75; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(800);
const ratio = await ev(`document.querySelectorAll('app-player-bar app-waveform rect.played').length / 64`);
check('… se déplacer dans le morceau (curseur sous la forme d’onde)', ratio > 0.6, `part écoutée ${ratio}`);
await shot('mv6-forme-onde-lecteur', false);
await ev(`document.querySelector('app-player-bar .play-btn')?.click()`);

console.log('=== 2. PAGE D’UNE PISTE ET TÉLÉCHARGEMENT');
await ev(`localStorage.removeItem('gpc_token')`);
await go(`/t/${soleil.id}`, 3500);
check('visiteur : page de la piste publique avec grande forme d’onde', /Soleil de Douala/.test((await text('h1')) ?? '') && (await ev(`document.querySelectorAll('.big-wave rect:not(.empty)').length`)) === 64);
check('visiteur : invité à se connecter pour commenter', /Connectez-vous pour laisser un commentaire/.test(await main()));
await spyDownloads();
await click(`[...document.querySelectorAll('.buttons .btn')].find(b => b.textContent.includes('Télécharger'))`);
await waitFor(`window.__downloads.length > 0`, 10000);
check('visiteur : téléchargement d’une piste publique (nom = titre)', (await ev(`window.__downloads[0]`)) === 'Soleil de Douala.mp3', await ev(`JSON.stringify(window.__downloads)`));
await go(`/t/${secret.id}`, 3000);
check('visiteur : piste privée → message et bouton de connexion', /connectez-vous/i.test(await main()) && !!(await ev(`!!document.querySelector('a.btn.primary[href^="/login"]')`)), (await main()).slice(0, 160));
check('API : téléchargement d’une piste privée refusé au visiteur (401) et à Bob (403), permis à Alice (200)',
  (await api(`/tracks/${secret.id}/download`, null)).status === 401 && (await api(`/tracks/${secret.id}/download`, B.token)).status === 403 && (await api(`/tracks/${secret.id}/download`, A.token)).status === 200);
await as(B, `/t/${secret.id}`, 3000);
check('Bob : piste privée d’Alice → « pas été partagée avec vous »', /pas été partagée avec vous/.test(await main()));

console.log('=== 3. COMMENTAIRES');
await go(`/t/${soleil.id}`, 3500);
check('Bob peut commenter une piste publique', !!(await ev(`!!document.querySelector('#comment-text')`)));
await type('#comment-text', 'Superbe ambiance, bravo !'); await sleep(300);
await click(`document.querySelector('.new-comment button[type=submit]')`); await sleep(1500);
check('commentaire publié et affiché en tête', /Superbe ambiance, bravo !/.test((await text('.list .comment .text')) ?? '') && (await text('#comments-title .count')) === '1');
await shot('mv6-commentaires');
const notifA = (await (await api('/notifications', A.token)).json()).items;
check('Alice est prévenue (notification « commentaire »)', notifA.some((n) => n.type === 'comment' && n.track?.id === soleil.id && n.actor.name === 'Bob Beat'));
await as(A, `/t/${soleil.id}`, 3500);
check('Alice (auteur de la piste) peut supprimer le commentaire de Bob', !!(await ev(`!!document.querySelector('.comment .icon-btn[aria-label^="Supprimer"]')`)));
await as(C, `/t/${soleil.id}`, 3500);
check('Chloé voit le commentaire mais ne peut pas le supprimer', /Superbe ambiance/.test(await main()) && !(await ev(`!!document.querySelector('.comment .icon-btn')`)));
check('API : commenter une piste privée sans accès est refusé (403)', (await api(`/tracks/${secret.id}/comments`, C.token, { method: 'POST', body: JSON.stringify({ text: 'Coucou' }) })).status === 403);
await go('/explore', 3000);
await click(`${tile('Soleil de Douala')}.querySelector('button[aria-label^="Plus d’actions"]')`); await sleep(500);
const menu = await ev(`[...document.querySelectorAll('.menu-item')].map(b => b.textContent.trim()).join(' | ')`);
check('menu « ⋯ » : Télécharger, Commentaires, Remixer, Signaler', /Télécharger/.test(menu) && /Commentaires/.test(menu) && /Remixer/.test(menu) && /Signaler/.test(menu), menu);
await click(`[...document.querySelectorAll('.menu-item')].find(b => b.textContent.includes('Commentaires'))`); await sleep(2500);
check('… « Commentaires » ouvre la page de la piste', (await ev('location.pathname')) === `/t/${soleil.id}`);

console.log('=== 4. S’ABONNER À UN ARTISTE');
await as(B, `/u/${A.user.id}`, 3500);
await click(`[...document.querySelectorAll('.actions .btn')].find(b => b.textContent.includes('S’abonner'))`); await sleep(1500);
check('Bob s’abonne à Alice : bouton « Abonné(e) » et compteur à 1', /Abonné\(e\)/.test((await ev(`[...document.querySelectorAll('.actions .btn')].map(b => b.textContent).join('|')`)) ?? '') && /1 abonné/.test((await text('[data-testid=followers]')) ?? ''));
await shot('mv6-abonnement');
check('Alice reçoit une notification « abonnement »', (await (await api('/notifications', A.token)).json()).items.some((n) => n.type === 'follow' && n.actor.name === 'Bob Beat'));
await api(`/tracks/${secret.id}`, A.token, { method: 'PATCH', body: JSON.stringify({ visibility: 'public' }) });
check('Alice rend une piste publique → Bob (abonné) est prévenu', (await (await api('/notifications', B.token)).json()).items.some((n) => n.type === 'new_release' && n.track?.id === secret.id));
await go('/friends', 3500);
check('fil d’activité de Bob (sans être ami) : la nouvelle piste d’Alice', /Démo secrète/.test(await main()), (await main()).slice(0, 200));
await go('/friends?tab=follows', 3000);
check('onglet « Abonnements » : Alice dans « Artistes que je suis »', /Artistes que je suis \(1\)/.test(await main()) && /Alice Vibe/.test(await main()));
await api(`/tracks/${secret.id}`, A.token, { method: 'PATCH', body: JSON.stringify({ visibility: 'private' }) });

console.log('=== 5. PARTAGER UNE PLAYLIST');
const request = await (await api('/friends/requests', A.token, { method: 'POST', body: JSON.stringify({ userId: B.user.id }) })).json();
await api(`/friends/requests/${request.requestId}/accept`, B.token, { method: 'POST' });
const playlist = await (await api('/playlists', A.token, { method: 'POST', body: JSON.stringify({ name: 'Été 2026' }) })).json();
for (const track of [soleil, secret]) await api(`/playlists/${playlist.id}/tracks`, A.token, { method: 'POST', body: JSON.stringify({ trackId: track.id }) });
await as(A, '/library?tab=playlists', 3500);
await click(`[...document.querySelectorAll('.row')].find(r => r.textContent.includes('Été 2026')).querySelector('.actions .btn:nth-child(2)')`); await sleep(1800);
check('fenêtre « Partager la playlist » ouverte', !!(await ev(`!!document.querySelector('app-playlist-share-dialog [role=dialog]')`)));
await click(`[...document.querySelectorAll('app-playlist-share-dialog .list li')].find(li => li.textContent.includes('Bob Beat')).querySelector('button')`); await sleep(1800);
check('playlist partagée avec Bob (passe en « Amis choisis »)', /Bob Beat peut maintenant voir la playlist/.test((await text('app-playlist-share-dialog .notice')) ?? '') && (await ev(`document.querySelector('app-playlist-share-dialog input[value=friends]').checked`)));
await shot('mv6-partage-playlist', false);
await ev(`document.querySelector('app-playlist-share-dialog .icon-btn').click()`); await sleep(500);
check('badge de la playlist : « Amis choisis (1) »', /Amis choisis \(1\)/.test((await ev(`[...document.querySelectorAll('.row')].find(r => r.textContent.includes('Été 2026')).querySelector('.badge').textContent`)) ?? ''));
await as(B, '/', 3500);
await click(`document.querySelector('.side-bell .bell')`); await sleep(1500);
check('Bob : notification « a partagé la playlist »', /a partagé la playlist « Été 2026 »/.test((await text('.side-bell .panel')) ?? ''));
await click(`[...document.querySelectorAll('.side-bell .panel .item')].find(i => i.textContent.includes('Été 2026'))`); await sleep(3000);
check('… elle mène à la page de la playlist', (await ev('location.pathname')) === `/p/${playlist.id}`);
check('Bob voit la piste publique, la piste privée d’Alice reste masquée', /Soleil de Douala/.test(await main()) && !/Démo secrète/.test(await main()) && /1 piste\(s\) de cette playlist ne vous sont pas accessibles/.test(await main()), (await main()).slice(0, 240));
await go('/library?tab=shared', 3500);
check('Bob : « Playlists partagées avec moi » dans la bibliothèque', /Été 2026/.test(await main()) && /de Alice Vibe/.test(await main()));
await as(C, `/p/${playlist.id}`, 3500);
check('Chloé (non invitée) ne voit pas la playlist', /n’est pas partagée avec vous/.test(await main()));
await as(A, '/library?tab=playlists', 3500);
await click(`[...document.querySelectorAll('.row')].find(r => r.textContent.includes('Été 2026')).querySelector('.actions .btn:nth-child(2)')`); await sleep(1800);
await click(`document.querySelector('app-playlist-share-dialog input[value=private]')`); await sleep(1500);
check('Alice repasse la playlist en privée : Bob n’y a plus accès', (await api(`/playlists/${playlist.id}`, B.token)).status === 404);

await finish();
