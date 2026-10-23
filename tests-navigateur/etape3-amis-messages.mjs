/**
 * Test navigateur MOST VIBE — Étape 3 (sections 6 et 7) : invitations, cloche, fil d'activité, profils, messagerie, carte musicale, « Partage interrompu », blocage.
 * Base de démonstration most-vibe-demo, comptes A (Alice), B (Bob), C (Chloé).
 * Chrome sans fenêtre et muet (voir lib.mjs). Lancement : node tests-navigateur/run-all.mjs
 */
import { api, as, check, click, ev, finish, go, key, login, logs, send, shot, sleep, text, type } from './lib.mjs';

const A = await login('alice@mostvibe.test');
const B = await login('bob@mostvibe.test');
const C = await login('chloe@mostvibe.test');
const aliceTracks = (await (await api('/tracks?limit=20', A.token)).json()).docs;
const secret = aliceTracks.find((t) => t.title === 'Démo secrète');

console.log('=== 1. ALICE INVITE BOB');
await as(A, '/friends', 3500);
check('fil vide expliqué quand on n’a pas d’amis', /pas encore d’amis/.test((await text('.panel')) ?? ''));
await click(`[...document.querySelectorAll('.tab')].find(t => t.textContent.includes('Trouver'))`); await sleep(1000);
await type('.panel input[type=search]', 'bob'); await sleep(1600);
check('recherche de profil par nom', /Bob Beat/.test((await text('.people')) ?? ''), await text('.people'));
await click(`[...document.querySelectorAll('.person button')].find(b => b.textContent.includes('Inviter'))`); await sleep(1500);
check('invitation envoyée', /Invitation envoyée à Bob Beat/.test((await text('.flash')) ?? '') && /Invitation envoyée/.test((await text('.people .tag')) ?? ''));
await shot('mv3-trouver-amis');

console.log('=== 2. BOB ACCEPTE');
await as(B, '/', 3500);
const badge = await ev(`[...document.querySelectorAll('.side-nav a')].find(a => a.textContent.includes('Amis'))?.querySelector('.nav-badge')?.textContent`);
check('pastille d’invitation sur « Amis »', badge === '1', `pastille=${badge}`);
check('pastille de la cloche', (await text('.side-bell .badge')) === '1');
await click(`document.querySelector('.side-bell .bell')`); await sleep(1500);
check('notification « vous invite »', /Alice Vibe vous invite à devenir amis/.test((await text('.side-bell .panel')) ?? ''));
const panelBox = await ev(`(() => { const r = document.querySelector('.side-bell .panel').getBoundingClientRect(); const side = document.querySelector('.sidebar').getBoundingClientRect(); return { left: r.left, right: r.right, sideRight: side.right, vw: innerWidth }; })()`);
check('panneau de la cloche entièrement visible, à côté du menu', panelBox.left >= panelBox.sideRight && panelBox.right <= panelBox.vw, JSON.stringify(panelBox));
await shot('mv3-cloche', false);
await click(`document.querySelector('.side-bell .panel .item')`); await sleep(2500);
check('la notification mène aux invitations', (await ev('location.pathname + location.search')) === '/friends?tab=invitations');
check('cloche lue → pastille effacée', !(await ev(`!!document.querySelector('.side-bell .badge')`)));
await click(`[...document.querySelectorAll('.person button')].find(b => b.textContent.includes('Accepter'))`); await sleep(1800);
check('invitation acceptée', /maintenant ami\(e\) avec Alice Vibe/.test((await text('.flash')) ?? ''));
await shot('mv3-invitation-acceptee');

console.log('=== 3. FIL D’ACTIVITÉ ET PROFILS (Alice)');
await as(A, '/friends', 4000);
const feedTitles = await ev(`[...document.querySelectorAll('.feed app-track-tile h3')].map(h => h.textContent.trim())`);
check('le fil montre les créations publiques de Bob', ['Café Jazz Club', 'Garage Riff', 'Sunset Mix vol.1'].every((t) => feedTitles?.includes(t)), JSON.stringify(feedTitles));
check('… mais jamais sa piste privée', !feedTitles?.includes('Brouillon de Bob'));
check('« a publié un mixage » pour un mixage', /a publié un mixage/.test((await text('.feed')) ?? ''));
await shot('mv3-fil-activite');
await go(`/u/${C.user.id}`, 3000);
const chloeTracks = await ev(`[...document.querySelectorAll('app-track-tile h3')].map(h => h.textContent.trim())`);
check('profil de Chloé : bouton Inviter, aucune piste privée', /Inviter/.test((await text('.actions')) ?? '') && !(chloeTracks ?? []).some((t) => /Démo secrète|Brouillon/.test(t)), JSON.stringify(chloeTracks));
await go(`/u/${B.user.id}`, 3000);
check('profil de Bob : « Ami(e) » et « Écrire »', /Ami\(e\)/.test((await text('.actions')) ?? '') && /Écrire/.test((await text('.actions')) ?? ''));
await shot('mv3-profil-bob');

console.log('=== 4. MESSAGERIE : texte et carte musicale');
await click(`[...document.querySelectorAll('.actions button')].find(b => b.textContent.includes('Écrire'))`); await sleep(3000);
check('« Écrire » ouvre la conversation', (await ev('location.pathname')).startsWith('/messages/'), await ev('location.pathname'));
const convId = (await ev('location.pathname')).split('/').pop();
await type('#composer-text', 'Salut Bob ! Écoute ma maquette.');
await key('Enter'); await sleep(1800);
check('message envoyé avec Entrée', /Salut Bob/.test((await text('.scroller')) ?? ''));
await click(`document.querySelector('.composer .attach')`); await sleep(2500);
check('« Envoyer une de mes pistes » s’ouvre', !!(await ev(`!!document.querySelector('app-track-picker [role=dialog]')`)));
await sleep(6000);
const rows = await ev(`[...document.querySelectorAll('app-track-picker .row')].map(r => r.querySelector('strong').textContent.trim() + ' | ' + r.querySelector('.info small').textContent.trim())`);
check('liste de MES pistes avec durée mesurée', rows?.length === 5 && rows.every((r) => /\d+:\d\d/.test(r)), JSON.stringify(rows));
const rowsHaveCover = await ev(`[...document.querySelectorAll('app-track-picker .row .thumb')].length`);
check('chaque ligne a une pochette (ou l’icône du style)', rowsHaveCover === 5);
await type('app-track-picker input[type=search]', 'secr'); await sleep(1800);
check('recherche dans mes pistes', JSON.stringify(await ev(`[...document.querySelectorAll('app-track-picker .row strong')].map(s => s.textContent.trim())`)) === '["Démo secrète"]');
await click(`document.querySelector('app-track-picker .row .icon-btn')`); await sleep(2500);
check('pré-écoute lancée (lecteur local)', (await ev(`document.querySelector('app-track-picker .row .icon-btn')?.getAttribute('aria-label')`))?.startsWith('Arrêter'));
await shot('mv3-choisir-piste', false);
await click(`document.querySelector('app-track-picker .row .send')`); await sleep(2500);
check('la piste part en carte musicale', /Démo secrète/.test((await text('.bubble-row.mine:last-child .card')) ?? ''), await text('.bubble-row.mine:last-child .card'));
const durationSaved = (await (await api(`/tracks?limit=20`, A.token)).json()).docs.find((t) => t.title === 'Démo secrète').durationSeconds;
check('la durée mesurée est enregistrée en base', durationSaved > 0, `${durationSaved} s`);
check('pas de flèche « retour » sur ordinateur', await ev(`getComputedStyle(document.querySelector('.back')).display === 'none'`));
await shot('mv3-conversation-alice');
const st = async (who) => (await api(`/tracks/${secret.id}/audio`, who.token)).status;
check('piste privée envoyée : Bob 200, Chloé 403', (await st(B)) === 200 && (await st(C)) === 403, `Bob=${await st(B)} Chloé=${await st(C)}`);
check('la piste reste privée', (await (await api(`/public/tracks/${secret.id}`, A.token)).json()).visibility === 'private');

console.log('=== 5. BOB LIT ET ÉCOUTE');
await as(B, '/', 3500);
const msgBadge = await ev(`[...document.querySelectorAll('.side-nav a')].find(a => a.textContent.includes('Messages'))?.querySelector('.nav-badge')?.textContent`);
check('pastille « Messages » : 2 non lus', msgBadge === '2', `pastille=${msgBadge}`);
await go('/messages', 3000);
check('conversation non lue en gras avec compteur', (await text('.conversation.unread .unread-badge')) === '2');
await click(`document.querySelector('.conversation')`); await sleep(3000);
check('carte musicale lisible par Bob', /Démo secrète.*Alice Vibe/.test((await text('.card')) ?? ''), await text('.card'));
await click(`document.querySelector('.card .card-play')`); await sleep(3000);
check('Bob écoute la piste depuis la carte', (await text('.player-bar .now-text strong')) === 'Démo secrète');
await ev(`document.querySelector('.player-bar .play-btn')?.click()`);
await sleep(800);
const afterRead = await ev(`[...document.querySelectorAll('.side-nav a')].find(a => a.textContent.includes('Messages'))?.querySelector('.nav-badge')?.textContent ?? '0'`);
check('après lecture, la pastille disparaît', afterRead === '0', `pastille=${afterRead}`);
await type('#composer-text', 'Super, merci !');
await click(`document.querySelector('.composer .send')`); await sleep(1500);
await shot('mv3-conversation-bob');

console.log('=== 6. RETRAIT : « Partage interrompu »');
await as(A, '/library', 3500);
await click(`[...document.querySelectorAll('.rows .row')].find(r => r.textContent.includes('Démo secrète')).querySelector('.btn.ghost')`); await sleep(2000);
check('la fenêtre de partage montre l’accès « Envoyée par message »', /Bob Beat.*Envoyée par message/.test((await text('.grants')) ?? ''), await text('.grants'));
const candidates = await ev(`[...document.querySelectorAll('.results .name')].map(n => n.textContent.trim())`);
check('« Amis choisis » ne propose que des amis (pas Chloé)', !(candidates ?? []).includes('Chloé Groove'), JSON.stringify(candidates));
await click(`[...document.querySelectorAll('.grants li button')].find(b => b.textContent.includes('Retirer'))`); await sleep(400);
await click(`[...document.querySelectorAll('.grants li button')].find(b => b.textContent.includes('Confirmer'))`); await sleep(1800);
check('message après retrait', /déjà téléchargé ne peut pas être récupéré/.test((await text('app-share-dialog .notice')) ?? ''));
await go(`/messages/${convId}`, 3000);
check('Alice voit « Accès retiré à Bob Beat » sur sa carte', /Accès retiré à Bob Beat/.test((await text('.scroller')) ?? ''));
await as(B, `/messages/${convId}`, 3500);
check('Bob voit « Partage interrompu »', /Partage interrompu/.test((await text('.card.interrupted')) ?? ''), await text('.card.interrupted'));
check('… sans bouton de lecture', !(await ev(`!!document.querySelector('.card.interrupted .card-play')`)));
check('… et le serveur refuse le fichier (403)', (await st(B)) === 403);
await shot('mv3-partage-interrompu');

console.log('=== 7. BLOCAGE');
await as(A, `/u/${C.user.id}`, 3000);
await click(`[...document.querySelectorAll('.actions button')].find(b => b.textContent.includes('Bloquer'))`); await sleep(500);
check('confirmation avant blocage', /Bloquer Chloé Groove \?/.test((await text('.confirm')) ?? ''));
await click(`document.querySelector('.confirm .btn.danger')`); await sleep(3000);
check('Chloé apparaît dans « Bloqués »', (await ev('location.search')) === '?tab=blocked' && /Chloé Groove/.test((await text('.people')) ?? ''));
const cSearch = (await (await api('/users/search?q=alice', C.token)).json()).users;
check('Chloé ne trouve plus Alice', cSearch.length === 0);
check('Chloé ne voit plus son profil (404)', (await api(`/users/${A.user.id}/profile`, C.token)).status === 404);
await shot('mv3-bloques');
await click(`[...document.querySelectorAll('.person button')].find(b => b.textContent.includes('Débloquer'))`); await sleep(1800);
check('déblocage', /débloqué/.test((await text('.flash')) ?? ''));

console.log('=== 8. MOBILE (400 px)');
await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 860, deviceScaleFactor: 2, mobile: true });
await go(`/messages/${convId}`, 3500);
const overflow = await ev(`document.documentElement.scrollWidth - window.innerWidth`);
check('conversation sur mobile, sans débordement', overflow <= 0 && !(await ev(`getComputedStyle(document.querySelector('.list')).display !== 'none'`)), `${overflow} px`);
check('bouton retour visible sur mobile', await ev(`getComputedStyle(document.querySelector('.back')).display !== 'none'`));
const cardFits = await ev(`[...document.querySelectorAll('.bubble')].every(b => { const c = b.querySelector('.card'); return !c || c.getBoundingClientRect().right <= b.getBoundingClientRect().right + 0.5; })`);
check('carte musicale contenue dans sa bulle sur mobile', cardFits);
const mobileNav = await ev(`[...document.querySelectorAll('.bottom-nav a, .bottom-nav button')].map(a => a.textContent.trim())`);
check('« Messages » dans la barre mobile', (mobileNav ?? []).some((label) => label.startsWith('Messages')), JSON.stringify(mobileNav));
await shot('mv3-mobile-conversation');
await go('/friends', 3500);
check('page Amis sur mobile sans débordement', (await ev(`document.documentElement.scrollWidth - window.innerWidth`)) <= 0);
check('cloche dans l’en-tête mobile', await ev(`!!document.querySelector('.mobile-top app-notification-bell')`));
await shot('mv3-mobile-amis');
await send('Emulation.clearDeviceMetricsOverride');

await finish();
