/**
 * Test navigateur MOST VIBE — Étape 1 (sections 1 à 3) : identité visuelle, navigation,
 * pages publiques sans compte, recherche et filtres, droits sur les liens directs.
 * Base de démonstration most-vibe-demo, comptes A (Alice), B (Bob), C (Chloé).
 * Chrome sans fenêtre et muet (voir lib.mjs). Lancement : node tests-navigateur/run-all.mjs
 */
import { api, as, check, click, ev, finish, go, login, send, shot, sleep, text } from './lib.mjs';

// Anciennes couleurs du projet de départ (vert sombre, bleu marine, gris du studio) : interdites.
const OLD = ['rgb(18, 61, 50)', 'rgb(29, 117, 94)', 'rgb(23, 49, 42)', 'rgb(13, 15, 19)', 'rgb(21, 24, 30)', 'rgb(243, 247, 245)', 'rgb(16, 44, 37)', 'rgb(23, 75, 62)', 'rgb(27, 31, 39)', 'rgb(35, 40, 51)'];
const oldColors = () =>
  ev(`(() => { const old = ${JSON.stringify(OLD)}; const hits = new Set(); for (const el of document.querySelectorAll('body *')) { const s = getComputedStyle(el); for (const v of [s.color, s.backgroundColor, s.borderTopColor]) if (old.includes(v)) hits.add(el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + ' → ' + v); } return [...hits].slice(0, 5); })()`);

console.log('=== 1. IDENTITÉ VISUELLE ET ACCUEIL (visiteur, sans compte)');
await go('/', 4000);
const tokens = await ev(`['--mv-primary','--mv-secondary','--mv-bg','--mv-card','--mv-text'].map(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim().toLowerCase())`);
check('couleurs de la charte (#007FFF, #A99BEF, #F5FAFF, #FFFFFF, #18324F)', JSON.stringify(tokens) === JSON.stringify(['#007fff', '#a99bef', '#f5faff', '#ffffff', '#18324f']), JSON.stringify(tokens));
check('nom MOST VIBE et logo MV', (await text('.sidebar .logo')) === 'MV' && (await text('.sidebar .brand-name')) === 'MOST VIBE');
check('titre de l’onglet du navigateur', (await ev('document.title')).includes('MOST VIBE'), await ev('document.title'));
check('aucune ancienne couleur à l’écran', !(await oldColors()).length, JSON.stringify(await oldColors()));
const visitorMenu = await ev(`[...document.querySelectorAll('.side-nav a')].map(a => a.textContent.trim())`);
check('menu visiteur : Accueil et Explorer seulement', JSON.stringify(visitorMenu) === '["Accueil","Explorer"]', JSON.stringify(visitorMenu));
const styles = await ev(`[...document.querySelectorAll('.style-chip')].map(c => c.textContent.replace(/\\d+/g, '').trim())`);
check('les 8 styles (hip-hop, afro, électro, pop, jazz, rock, dance, autres)', styles?.length === 8, JSON.stringify(styles));
const sections = await ev(`[...document.querySelectorAll('.block h2')].map(h => h.textContent.trim())`);
check('sections : ajouts récents, sélection, mixages, albums', ['récents', 'élection', 'ixages', 'lbums'].every((part) => sections?.some((title) => title.includes(part))), JSON.stringify(sections));
const firstTile = await ev(`(() => { const t = document.querySelector('app-track-tile'); return t && [!!t.querySelector('.art'), t.querySelector('h3')?.textContent.trim(), t.querySelector('.style')?.textContent.trim(), t.querySelector('.author')?.textContent.trim()]; })()`);
check('chaque piste : pochette, titre, style et auteur', firstTile?.every(Boolean), JSON.stringify(firstTile));
check('aucun contenu privé sur l’accueil', !/Démo secrète|Brouillon de Bob/.test((await ev('document.body.innerText')) ?? ''));
await shot('etape1-accueil-visiteur');

console.log('=== 2. LECTEUR PERSISTANT');
await click(`document.querySelector('app-track-tile button.play')`);
await sleep(3000);
const playing = await text('.player-bar .now-text strong');
check('lecture d’une piste publique sans compte', !!playing && (await ev(`document.querySelector('.player-bar .play-btn')?.getAttribute('aria-label')`)) === 'Pause', playing);
await click(`[...document.querySelectorAll('.side-nav a')].find(a => a.textContent.trim() === 'Explorer')`);
await sleep(2500);
check('la musique continue en changeant de page', (await text('.player-bar .now-text strong')) === playing && (await ev(`document.querySelector('.player-bar .play-btn')?.getAttribute('aria-label')`)) === 'Pause');
await ev(`document.querySelector('.player-bar .play-btn')?.click()`);

console.log('=== 3. RECHERCHE ET FILTRES (Explorer)');
const results = async (query) => {
  await go('/explore' + query, 2500);
  return ev(`[...document.querySelectorAll('app-track-tile h3')].map(h => h.textContent.trim()).sort()`);
};
check('7 pistes publiques en tout', (await results('')).length === 7);
check('une piste privée n’est jamais trouvée (titre)', (await results('?q=secr%C3%A8te')).length === 0);
check('ni celle de Bob', (await results('?q=brouillon')).length === 0);
check('filtre par style', JSON.stringify(await results('?style=afro')) === '["Soleil de Douala"]');
check('filtre par auteur', (await results('?author=bob')).length === 3);
check('filtre par album', JSON.stringify(await results('?album=lumi%C3%A8re')) === '["Neon Avenue","Soleil de Douala"]');
check('filtre par tag', JSON.stringify(await results('?tag=%C3%A9t%C3%A9')) === '["Bleu Azur","Soleil de Douala"]');
check('filtre « mixages »', JSON.stringify(await results('?kind=mix')) === '["Sunset Mix vol.1"]');
await go('/explore?q=zzzzzz', 2500);
check('aucun résultat : message utile', /Aucun contenu public ne correspond/.test((await text('main')) ?? ''));

console.log('=== 4. DROITS SUR LES LIENS DIRECTS');
const A = await login('alice@mostvibe.test');
const B = await login('bob@mostvibe.test');
const aliceTracks = (await (await api('/tracks?limit=20', A.token)).json()).docs;
const secret = aliceTracks.find((track) => track.title === 'Démo secrète');
const publicOne = aliceTracks.find((track) => track.visibility === 'public');
const audio = async (track, user) => (await api(`/tracks/${track.id}/audio`, user?.token)).status;
check('piste publique : visiteur 200', (await audio(publicOne)) === 200);
check('piste privée : visiteur 401, autre membre 403, propriétaire 200', (await audio(secret)) === 401 && (await audio(secret, B)) === 403 && (await audio(secret, A)) === 200);
check('lien direct ouvert dans le navigateur par un visiteur : 401', (await ev(`fetch('/api/tracks/${secret.id}/audio').then(r => r.status)`)) === 401);

console.log('=== 5. MEMBRE CONNECTÉ ET MOBILE');
await as(A, '/tracks', 4000);
const menu = await ev(`[...document.querySelectorAll('.side-nav a')].map(a => a.textContent.trim())`);
check('menu membre : Accueil, Explorer, Ma bibliothèque, Mixage, Amis, Messages, Paramètres (+ onglets conservés)', ['Accueil', 'Explorer', 'Ma bibliothèque', 'Backing tracks', 'Audio', 'Mixage', 'Amis', 'Messages', 'Paramètres'].every((item) => menu?.includes(item)), JSON.stringify(menu));
check('onglets Backing tracks, Audio et Mixage conservés', ['Backing tracks', 'Audio', 'Mixage'].every((item) => menu?.includes(item)));
check('envoi : visibilité « Privé » par défaut', (await ev(`document.querySelectorAll('.upload-card select')[1]?.value`)) === 'private');
await go('/mix', 4000);
check('studio de mixage : deux platines, sans anciennes couleurs', (await ev(`document.querySelectorAll('app-dj-deck').length`)) === 2 && !(await oldColors()).length);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go('/', 3500);
check('mobile : barre de navigation en bas, pas de menu vertical', (await ev(`getComputedStyle(document.querySelector('.sidebar')).display`)) === 'none' && (await ev(`document.querySelectorAll('.bottom-nav a').length`)) === 4);
check('mobile : aucun débordement horizontal', (await ev('document.documentElement.scrollWidth - window.innerWidth')) <= 0);
await shot('etape1-mobile');
await send('Emulation.clearDeviceMetricsOverride');

await finish();
