# Rapport IA — Suivi du projet « Mixage DJ »

Ce fichier trace **chaque demande** faite à l'assistant IA (Claude Code), **dans l'ordre chronologique**, les unes à la suite des autres. Chaque demande est ajoutée dès qu'elle est faite, même si le travail est encore en cours, puis complétée avec ce qui a été fait.

**Règles fixées par l'étudiante :**
1. Ne pas modifier le backend (`backend/`), les web services ni le contrat `API_CONTRACT.md`.
2. Garder le squelette existant et ajouter les fonctions dans un nouvel onglet.
3. Mettre à jour ce rapport à **chaque demande**, en citant la demande, les unes à la suite des autres.
4. Quand une correction est demandée, dire clairement **ce qui n'allait pas** dans la version précédente et **ce qui a été changé** pour le réparer.

## Journal des demandes (ordre chronologique)

| N° | Date | Demande | Résultat | Backend modifié ? |
|---|---|---|---|---|
| 1 | 11/10/2026 | Présentation du projet et de l'idée « plateforme DJ », discussion sans modification | Discussion : fonctions possibles, Web Audio API, questions | Non |
| 2 | 11/10/2026 | « Tu connais You.DJ ? Je veux faire un truc comme ça avec sa propre musique » | Discussion : maquette de l'onglet, faisabilité de chaque fonction | Non |
| 3 | 11/10/2026 | Analyser le projet, ajouter un onglet Mixage façon You.DJ sans toucher au squelette, créer ce rapport | Onglet Mixage créé (2 platines, mixeur, scratch, sync, effets, enregistrement) | Non |
| 4 | 11/10/2026 | « Est-ce que tu pourras intégrer Butterchurn ? Ne modifie pas le backend » | Butterchurn intégré dans un cadre de l'onglet | Non |
| 5 | 11/10/2026 | Butterchurn en fond d'écran animé + plein écran de bord à bord + règle de compte rendu des corrections | Fond animé et plein écran corrigés, testés dans les deux modes | Non |
| 6 | 11/10/2026 | « Pourquoi la musique se lance seule ? Il faut arranger ça » | Cause : navigateur de test de l'IA non muet ; tests rendus muets | Non |
| 7 | 11/10/2026 | « Tu as mis à jour le fichier rapport IA ? » | Vérification du rapport | Non |
| 8 | 11/10/2026 | « Est-il possible de me générer des musiques de plusieurs catégories ? » | Réponse : oui, morceaux instrumentaux synthétisés par programme | Non |
| 9 | 11/10/2026 | Générer 50 musiques par genre : House, Dance House, Electro, Pop, Hip-hop, Techno, Dubstep, Autre | 400 morceaux générés (559 Mo) ; défaut du détecteur de BPM de l'application découvert et corrigé | Non |
| 10 | 11/10/2026 | « Pourquoi je ne vois pas les prompts récents dans le rapport ? » | Rapport réorganisé dans l'ordre chronologique, chaque demande citée | Non |
| 11 | 11/10/2026 | Ajouter des morceaux depuis internet (lien direct + catalogue libre Jamendo), utilisables sur les decks comme un morceau local | Fait et testé ; serveur intermédiaire pour les sites sans CORS proposé, en attente de décision | Non |
| 12 | 11/10/2026 | Ajouter les musiques générées et les classer par catégories dans Backing tracks et Mixage, avec une jolie présentation | 400 morceaux importés et classés ; grille de catégories (Backing tracks) et bacs (Mixage) | Non (code) — 400 fichiers ajoutés aux données via l'API |
| 13 | 12/10/2026 | Lancer automatiquement la lecture dès qu'un morceau est choisi pour le lecteur 1 ou 2 (sans appuyer sur Lecture) | Fait et testé ; interrupteur « Lecture automatique » (activé par défaut) | Non |
| 14 | 12/10/2026 | Remplacer les icônes et emojis par des icônes professionnelles | Fait : icônes vectorielles Lucide partout, plus aucun emoji | Non |
| 15 | 12/10/2026 | Nouvel onglet Audio : écoute simple, Butterchurn qui suit le rythme, vitesse de lecture, volume, mode arrière-plan | Fait et testé (lecteur, vitesse, volume, visuels en cadre ou en fond d'écran, lecture en arrière-plan avec mini-lecteur) | Non |
| 16 | 14/10/2026 | « Pourquoi j'ai une erreur de connexion lors du login ? » | Cause : le backend n'était plus démarré ; relancé, le login fonctionne de nouveau | Non |
| 17 | 14/10/2026 | Mission « MOST VIBE » : transformer le projet en mini réseau social de partage audio (13 sections) | Étape 0 (branche, sauvegarde, migrations) et sections 1 à 3 terminées et testées ; **point avant les sections 4 et 5** | Oui (autorisé le 14/10/2026) |
| 18 | 14/10/2026 | « 1 » : continuer la mission MOST VIBE avec les sections 4 et 5 | Étape 2 faite : bibliothèque, j'aime/favoris (action après connexion), playlists, « Amis choisis » avec retrait d'accès, morceaux en ligne en base ; tests 18/18 + 38/38 + 38/38 | Oui (mission MOST VIBE) |
| 19 | 14/10/2026 | « pas de commit. c'est moi qui doit le faire, continue avec les sections 6 et 7 » (+ « tu as d'abord fait le commit? », « pourquoi interrupted ») | Étape 3 faite : amis, invitations, blocage, profils, fil d'activité, notifications, messagerie avec cartes musicales et « Partage interrompu » ; tests 24/24 + 42/42 + 51/51 ; aucun commit | Oui (mission MOST VIBE) |
| 20 | 14/10/2026 | « oui » : continuer la mission MOST VIBE avec les sections 8, 9 et 10 | Étape 4 faite : brouillons de mixage repris, publication avec autorisation de remix et crédits figés, paramètres et suppression du compte, signalements et administration (contenus publics seulement) ; tests 32/32 + 46/46 + 49/49 (+ 51/51 de non-régression) ; aucun commit | Oui (mission MOST VIBE) |
| 21 | 14/10/2026 | « l'onglet des piste depasse l'onglet qui permet d'importer les musiques essaie d'ajuster ça » | Corrigé : colonne d'import à largeur garantie, champs adaptés, empilement sous 1100 px ; vérifié de 1440 à 400 px | Non (mise en page) |
| 22 | 15-16/10/2026 | « oui » : continuer la mission MOST VIBE avec les sections 11, 12 et 13 | Étape 5 faite : finitions vérifiées page par page, recette A/B/C rangée dans le projet (197 réussis, 0 échoué(s)), livrables et mise en ligne documentés (non mise en ligne) ; aucun commit | Oui (mission MOST VIBE) |
| 23 | 16/10/2026 | « c'est quoi le probleme rencontré? » | Réponse : aucun défaut de l'application ; blocages des outils de test (lanceur, port de l'API de démo, API de démo restée allumée depuis la veille), corrigés ; recette finale 197/197 | Non (question) |

---

## Demande 1 — Présentation du projet (discussion)

> « Je suis en train de travailler sur un projet de plateforme de musique […] pour un utilisateur de pouvoir téléverser sa musique locale sur la plateforme, et la plateforme a pour rôle de lire la musique et la stocker dans une sorte de playlist. […] Je veux rendre mon application de telle sorte que ça soit une plateforme de mixage et DJ […] avoir un mixeur, un lecteur […] Il a également parlé d'un « bêta chat » […] J'aimerais qu'on puisse en discuter sans que tu modifies. »

**Réponse :** discussion uniquement, aucun fichier modifié. Fonctions proposées :
- deux platines, un crossfader et un égaliseur ;
- la forme d'onde, le BPM et le sync ;
- les effets et le scratch ;
- une réalisation avec la Web Audio API.

Le mot « bêta chat », mal transcrit par la dictée vocale, a été soumis à l'étudiante (beatmatching ?).

## Demande 2 — Le modèle You.DJ (discussion)

> « Est-ce que tu connais l'application You.DJ ? Moi je veux faire un truc comme ça mais avec la possibilité d'ajouter sa propre musique […] je veux avoir la possibilité de faire des mixages, scratch, synchro rythme en arrière-plan, deux lecteurs, un égaliseur et des effets depuis l'onglet mixage ou DJ. »

**Réponse :** discussion uniquement, aucun fichier modifié. Contenu de la réponse :
- une maquette de l'onglet ;
- un tableau de faisabilité : scratch par AudioWorklet, sync par détection du BPM ;
- un ordre de réalisation ;
- des questions sur le backend et la date de rendu.

## Demande 3 — Création de l'onglet Mixage

> « Essaie de voir mon projet. Ne modifie pas le squelette, parce que je veux qu'on garde les web services […] J'ai envie d'ajouter un onglet Mixage qui va permettre à un DJ de faire la table de mixage comme à peu près sur l'application You.DJ. À la fin, tout ce que tu feras comme modification, je veux que tu me crées un fichier rapport IA .md où tu mettras la date, et à chaque fois qu'on y changera, tu mettras à jour ce fichier. »

### Décisions d'architecture

- **Aucune nouvelle route API.** Les platines chargent l'audio avec `TrackService.audio(id)` : la route existante `GET /api/tracks/:id/audio`, avec le JWT ajouté par l'intercepteur. La bibliothèque utilise `TrackService.list()` (`GET /api/tracks`, `limit = 8`, dans la plage 1–20 du contrat).
- **Moteur audio dans un service racine** (`DjEngineService`, `providedIn: 'root'`). Le mix continue quand on change d'onglet, et il s'arrête à la déconnexion grâce à un `effect` sur `AuthService.token`.
- **Lecture par AudioWorklet**, et non par la balise `<audio>`. Un `AudioBufferSourceNode` ne sait pas lire à l'envers. Le processeur (`deck-processor.ts`) lit les échantillons à vitesse variable, positive ou négative. Pendant un scratch, il suit la position imposée par la main. C'est ce qui rend possibles le scratch, le pitch, les boucles et le calage précis.
- **Chaîne d'une voie :** lecteur → EQ 3 bandes (`lowshelf` 220 Hz, `peaking` 1 kHz, `highshelf` 3,2 kHz) → filtre DJ (passe-bas/passe-haut) → envois d'effets (écho calé sur le tempo, réverbération par convolution, flanger) → volume → crossfader à puissance constante → master → limiteur → haut-parleurs, vumètre et enregistreur.
- **Synchro en deux temps :**
  1. le bouton SYNC aligne le tempo (pitch) puis la phase des temps sur l'autre platine ;
  2. en arrière-plan, quatre fois par seconde, la platine synchronisée accélère ou ralentit très légèrement (±2 % au maximum) pour rester calée. Si l'écart dépasse 80 ms, elle se recale d'un coup.
- **Détection du BPM dans le navigateur :** filtre passe-bas rendu hors temps réel (`OfflineAudioContext`), enveloppe des attaques de basses, autocorrélation avec un filtre en peigne, puis affinage conjoint du tempo et de la phase. Le résultat est mis en cache dans `localStorage` par identifiant de piste. Les repères (cue, hot cues) y sont aussi conservés. Aucune donnée n'est envoyée au serveur.

### Fonctions disponibles dans l'onglet

| Zone | Fonctions |
|---|---|
| Platine A / B | Forme d'onde zoomée avec la grille des temps, vue d'ensemble cliquable, vinyle pour scratcher (souris, doigt ou flèches), Lecture/Pause, CUE, SYNC, pitch ±8/16/50 %, boutons de freinage et d'accélération, 4 hot cues (Maj+clic ou clic droit pour effacer), boucles de 1 à 16 temps, effets Écho, Réverb et Flanger, correction du BPM ½ / ×2 |
| Mixeur | Aigus, médiums, basses (−26 dB à +6 dB), filtre, volume de voie, vumètres, master, crossfader, enregistrement du mix (fichier `.webm` téléchargeable) |
| Bibliothèque | Pistes de l'utilisateur, recherche, pagination, boutons « Charger A/B » ou glisser-déposer sur une platine, BPM déjà connu |
| Clavier | Q/P lecture A/B · W/O cue A/B · S/L sync A/B |

### Fichiers créés

**Infrastructure partagée (`frontend-starter/src/app/shared/`) :**
- `models/dj.model.ts` : types (platine, bande d'EQ, effet, analyse, forme d'onde, boucle)
- `audio/deck-processor.ts` : code de l'AudioWorklet (lecture, vitesse variable, scratch, boucle)
- `audio/deck-engine.ts` : état (signaux) et graphe audio d'une platine
- `audio/track-analyzer.ts` : forme d'onde et détection du tempo et de la phase
- `audio/dj-storage.ts` : cache `localStorage` (BPM, repères)
- `services/dj-engine.service.ts` : moteur global (chargement, sync, crossfader, master, enregistrement)

**Composants (`frontend-starter/src/app/components/`) :** `mix-page`, `dj-deck`, `dj-mixer`, `dj-library`, `dj-waveform`, `dj-jog-wheel` et `dj-knob`. Chacun a ses fichiers `.ts`, `.html` et `.css`.

### Fichiers existants modifiés (ajouts uniquement)

| Fichier | Modification |
|---|---|
| `frontend-starter/src/app/routes.ts` | Ajout de la route `/mix`, chargée à la demande et protégée par `authGuard` |
| `frontend-starter/src/app/components/app/app.html` | Ajout du lien « 🎧 Mixage » dans la barre d'outils |

**Non modifiés :** tout `backend/`, `API_CONTRACT.md`, `TrackService`, `AuthService`, l'intercepteur, le guard et les autres pages.

### Vérifications

1. **Build :** `npm run build` réussi. **Tests existants :** 2 fichiers et 5 tests réussis.
2. **Détection du BPM** (signaux de grosse caisse synthétiques, 60 s) : 124 → 123,98 ; 93,5 → 93,49 ; 140 → 139,98 ; 170 → 169,97. Le premier temps est trouvé à 5 ms près.
   - La première version détectait 140 comme 70 et décalait la grille de 47 ms à 170 BPM.
   - Correction : préférence pour le double tempo et affinage conjoint tempo + phase.
   - Voir aussi la demande 9 : un autre défaut a été trouvé plus tard sur des grosses caisses réalistes.
3. **Processeur de platine** (test Node) : lecture à la bonne vitesse, pitch +8 % (1,081 s parcourue par seconde), scratch arrière de 0,5 s, boucle respectée, arrêt en fin de morceau.
4. **Navigateur réel** (Chrome headless piloté par script, compte de démonstration) :
   - chargement A/B et affichage du BPM ;
   - lecture des deux platines ;
   - SYNC ;
   - scratch à la souris (de 0:05.4 à 0:03.8) ;
   - aucune erreur dans la console.
   
   Le test a aussi révélé qu'un style global (`header { background: … }` dans `styles.css`) colorait les en-têtes de l'onglet. Correction : des `<div>` dans les nouveaux composants, sans toucher à `styles.css`.

**Preuve :** `captures/mixage_dj.png`.

### Limites connues

- **Le pitch change aussi la tonalité.** Il n'y a pas de « key lock ».
- **Pas de pré-écoute au casque :** le navigateur n'expose qu'une seule sortie audio.
- **La détection suppose un tempo stable.**
- **Pas de test automatisé Angular** pour les nouveaux composants.

### Ce que l'étudiante doit savoir expliquer

- Pourquoi un **AudioWorklet** plutôt que `<audio>` : on lit soi-même les échantillons, ce qui permet de lire à l'envers et de changer la vitesse en continu, donc de scratcher.
- Le chemin du son : platine → EQ → filtre → effets → volume → crossfader → master.
- Le principe de la **synchro** :
  - même tempo grâce au pitch : `pitch = BPM_cible / BPM_morceau − 1` ;
  - même phase : on décale l'écart entre les positions dans le temps courant ;
  - en arrière-plan, une petite correction continue de la vitesse maintient le calage.
- Pourquoi le backend n'a pas été modifié : tout le traitement audio se fait dans le navigateur à partir de la route existante `GET /api/tracks/:id/audio`.

## Demande 4 — Intégration de Butterchurn

> « Est-ce que tu pourras également intégrer le Butterchurn, ou tu l'as déjà fait ? Je précise encore bien : tu ne dois pas modifier le backend. »

**État avant la demande :** Butterchurn n'était pas intégré. Seul le plan d'essai `test.butterchurn` existait.

**Ce qui a été fait :**
- Ajout des paquets `butterchurn` 2.6.7 et `butterchurn-presets` 2.4.7 (versions exactes) dans `frontend-starter/package.json`.
- Création du composant `dj-visualizer` et du fichier `shared/audio/butterchurn.d.ts` (types TypeScript).
- Les visuels sont branchés sur la sortie master. Le composant propose 100 presets, le choix aléatoire, le changement automatique toutes les 30 s et le plein écran.
- Les bibliothèques ne sont téléchargées qu'au clic sur « Activer » (chargement à la demande).

**Vérification :** démarrage avec 100 presets dans Chrome, aucune erreur console. Le build réussit, avec deux avertissements d'optimisation car les paquets Butterchurn sont au format CommonJS.

**Non fait :** les shaders ISF prévus dans `test.butterchurn` ne sont pas intégrés.

## Demande 5 — Butterchurn en fond d'écran animé et plein écran

> « Dans l'onglet Mixage/DJ de l'application, ajoute le visualiseur Butterchurn comme fond d'écran animé, réagissant à la musique qui joue. Le canvas de Butterchurn doit être placé en arrière-plan, derrière les deux lecteurs, l'égaliseur, le crossfader et les effets […] le fond ne doit jamais capter les clics ni cacher l'interface […] branché sur la sortie finale du moteur audio (après le crossfader) […] Ajoute un bouton pour le mode plein écran […] Butterchurn doit occuper toute la page, de bord à bord […] mets en plein écran le conteneur principal […] écoute les événements resize et fullscreenchange […] en tenant compte du devicePixelRatio […] Teste le résultat dans les deux modes avant de me répondre. Règle pour la suite : […] ton compte rendu final doit dire clairement ce qui n'allait pas dans la version précédente et ce que tu as changé. » — « et mets à jour le fichier à chaque prompt »

### Ce qui n'allait pas et ce qui a été changé

| Problème de la version précédente | Correction |
|---|---|
| Butterchurn s'affichait dans un **cadre de la page**, et non en fond d'écran. | Le canvas est maintenant en `position: fixed; inset: 0; z-index: -1; pointer-events: none`. Il couvre toute la fenêtre, derrière l'interface, et ne capte aucun clic. Les panneaux deviennent translucides quand le fond est actif. |
| Le bouton « Plein écran » ne mettait en plein écran **que le cadre des visuels** : les platines disparaissaient. | Le plein écran porte sur le **conteneur de la console** (`.mix-page`). Butterchurn remplit l'écran derrière, et les platines restent utilisables par-dessus. |
| **Rendu faux sur écran haute densité** (DPR > 1) : Butterchurn recevait une taille en pixels CSS alors que le canvas était en pixels physiques. L'image n'occupait qu'une partie du canvas. | Le canvas et `setRendererSize()` reçoivent la même taille en pixels physiques (plafonnée à DPR 2). Elle est recalculée à chaque `resize` et `fullscreenchange`. |
| La page était élargie avec `translate`, ce qui empêche un élément `position: fixed` de couvrir la fenêtre. | L'élargissement se fait maintenant par des marges négatives, sans transform. |
| *(découvert en test)* **Le fond restait invisible en mode normal** : le fond opaque du `<body>` du squelette le recouvrait. | Tant que les visuels tournent, `body` et `.app-shell` deviennent transparents par un style en ligne, restauré ensuite. `styles.css` n'est pas modifié. |
| *(découvert en test)* **En plein écran, la console débordait à droite** et la platine B était coupée. | Les grilles et les canvas des formes d'onde peuvent maintenant rétrécir (`minmax(0, 1fr)`, `min-width: 0`). |

**Fichiers modifiés :**
- `dj-visualizer` (`.ts`, `.html`, `.css`) et `mix-page` (`.html`, `.css`) ;
- les feuilles de style de `dj-deck`, `dj-mixer`, `dj-library` et `dj-waveform` ;
- `butterchurn.d.ts`.

### Vérifications (Chrome piloté par script)

| Mode | Fenêtre | Canvas (pixels) | Attendu | Débordement | Clics |
|---|---|---|---|---|---|
| Normal, DPR 1 | 1382×804 | 1367×804 | 1367×804 | 0 px | play, crossfader, bouton EQ, « Charger A » : tous atteints |
| Fenêtre réduite, DPR 2 | 1000×700 | 1970×1400 | 1970×1400 | 0 px | — |
| Plein écran | 800×600 (écran headless) | 800×600 | 800×600 | 0 px | tous atteints |
| Sortie du plein écran | 1382×804 | 1367×804 | 1367×804 | 0 px | — |

- Aucune erreur console.
- Le build réussit et les 5 tests sur 5 passent.

**Captures :**
- `captures/mixage_fond_anime_normal.png` ;
- `captures/mixage_fond_anime_dpr2.png` ;
- `captures/mixage_fond_anime_plein_ecran.png`.

**Limite :** le plein écran n'a pas été observé sur un moniteur physique.

## Demande 6 — « La musique se lance seule »

> « Pourquoi la musique se lance seule ? Il faut arranger ça. »

**Cause :** ce n'était pas l'application, mais les **tests automatiques de l'IA**. Le Chrome invisible (headless) qui vérifiait l'onglet cliquait sur Lecture A et B, et il n'était pas muet : le son sortait sur les haut-parleurs, vers 18 h 40, 18 h 58 et 19 h 00.

**Vérification du code :** dans l'application, la lecture ne démarre qu'après une action de l'utilisateur :
- clic sur ▶ ;
- touches Q/P dans l'onglet Mixage ;
- bouton « Lire » de Backing tracks.

**Correction :** les scripts de test lancent désormais Chrome avec `--mute-audio`. Le test complet a été rejoué ainsi et passe toujours, sans aucun son.

## Demande 7 — Vérification du rapport

> « Tu as mis à jour le fichier rapport IA ? »

**Réponse :** oui pour les demandes 3 à 6. À ce moment-là, le journal était cependant rangé du plus récent au plus ancien. Voir la demande 10 pour la correction.

## Demande 8 — Générer des musiques ?

> « Est-ce qu'il est possible que tu puisses me générer des musiques de plusieurs catégories ? »

**Réponse :** oui, avec des limites.
- L'IA n'est pas un générateur de musique comme Suno ou Udio. Elle peut écrire un programme qui **synthétise** des morceaux note par note : batterie, basse, accords, mélodie.
- Les morceaux sont instrumentaux, sans voix, et libres de droits.
- Leur **tempo exact est connu**, ce qui est utile pour tester la détection du BPM et le SYNC.

Genres proposés : house, techno, hip-hop, drum & bass, afro house, reggaeton, lo-fi, trance.

## Demande 9 — 50 musiques par genre (en cours)

> « Genre de musique : House, Dance house, Electro, Pop, Hip hop, Techno, “depth depth stepd”, Pop, une autre catégorie appelée Autre. Tu me génères cinquante musiques par genre. N'oublie pas de mettre à jour le fichier rapport IA. »

**Interprétation :**
- 8 catégories de 50 morceaux, soit **400 morceaux** : House, Dance House, Electro, Pop, Hip-Hop, Techno, **Dubstep** et Autre.
- « depth depth stepd » a été compris comme *dubstep* (à confirmer, sinon *deep house*).
- « Pop » était cité deux fois et n'est compté qu'une fois.
- La catégorie « Autre » mélange trance, drum & bass, lo-fi, afro house, reggaeton et synthwave. Le sous-genre est indiqué dans le titre.

### Ce qui a été fait

- **Générateur** dans `outils/generateur-musique/`, séparé du frontend et du backend :
  - `moteur.mjs` : synthèse (oscillateurs, filtres, batterie, réverbération, écho, sidechain, mastering) ;
  - `compositeur.mjs` : un style par genre (tempo, gammes, grilles d'accords, motifs de batterie et de basse, mélodie), avec une structure adaptée au mix DJ : intro et outro rythmiques de 8 mesures, build, drop, break ;
  - `generer.mjs` : encodage MP3 128 kbit/s avec étiquettes ID3 (titre, genre, BPM, tonalité), travail en parallèle sur 7 cœurs, catalogue `catalogue.json` / `catalogue.csv`.
- **Fichiers produits :** environ 1 min 30 par morceau, environ 1,4 Mo en MP3, dans `musiques-generees/<n°-genre>/`.
- **Reproductibilité :** chaque morceau est entièrement déterminé par sa graine. Relancer la commande redonne les mêmes fichiers.

### Problèmes rencontrés et corrections

| Problème | Correction |
|---|---|
| L'encodeur MP3 `lamejs` 1.2.1 plante sous Node (« MPEGMode is not defined »). | Utilisation de sa version groupée `lame.all.js`. |
| Un premier essai mettait **environ 3 minutes par morceau**, soit près de 3 heures pour 400. La mesure a montré que la composition ne prenait que 1,5 s : c'est l'encodeur qui était lent. Chargé dans un contexte `vm` isolé, chaque accès à ses variables globales passait par un intermédiaire lent. | L'encodeur est évalué dans une simple fonction : **84 ms par seconde d'audio au lieu de 470 ms**. Durée estimée pour les 400 morceaux : environ 50 minutes. |
| **Défaut de l'application découvert grâce à ces morceaux :** le détecteur de BPM de l'onglet Mixage se trompait sur 7 morceaux sur 8. Sur une grosse caisse régulière à 125 BPM, il annonçait 83,33 BPM. Il mesurait l'énergie des basses sur 5,8 ms, alors qu'une vraie grosse caisse (environ 48 Hz) a un cycle de 21 ms : l'énergie « ondulait » et produisait une fausse attaque toutes les 11 ms. Le test de la demande 3 utilisait une grosse caisse trop courte pour le révéler. Ce défaut touchait aussi les vrais morceaux (probablement les 163,7 BPM de `song2.mp3`). | Dans `frontend-starter/src/app/shared/audio/track-analyzer.ts` : énergie mesurée sur une fenêtre glissante de 35 ms (plus longue qu'un cycle de grosse caisse) ; compression logarithmique pour la musique très compressée ; lissage des attaques. Ce dernier évite que le score d'un tempo dépende de l'alignement de ses multiples sur des pas entiers : c'est ce qui faisait gagner 83,3 BPM contre 125. |
| Essai non retenu : caler la grille sur l'énergie linéaire plutôt que logarithmique. | Résultat moins bon (Electro décalé de 215 ms) : **essai annulé**, retour à la version précédente. |
| Dans les morceaux Techno, la grille des temps était décalée d'environ une double-croche (100–122 ms) sur 3 morceaux sur 8. Hypothèses écartées une à une par élimination : basse, sidechain, arpège, accords, pad, percussions, clap. **Seule la grosse caisse comptait** : la grosse caisse techno a un balayage de hauteur (160 → 45 Hz), son énergie sous 150 Hz monte progressivement et sa plus forte montée arrive ~120 ms après le temps. Le détecteur calait la grille sur cette montée tardive. | Dans `track-analyzer.ts`, après le calage de la grille, les attaques sont **repliées sur un temps** autour de la phase trouvée. On retient **la première bosse** atteignant 40 % du maximum (l'attaque réelle), puis on remonte jusqu'au début de cette bosse. Techno : de 87–122 ms d'erreur à **0–58 ms**. Les autres genres passent de 6–12 ms à **0 ms**. |
| Essais non retenus pendant cette recherche : (1) caler la grille sur les maxima d'énergie plutôt que sur les montées ; (2) seuil de début d'attaque à 25 % ; (3) dans le générateur, sidechain techno réduit et motifs de basse simplifiés. | (1) et (2) donnaient de moins bons résultats et ont été **annulés**. (3) restait sans effet, puisque la cause était la grosse caisse. L'attaque plus douce de la basse techno, réglage réaliste, a été conservée. |

### Vérification du détecteur de BPM corrigé (8 morceaux d'essai, 1 par genre)

| Genre | Tempo réel | BPM avant correction | BPM après correction | Erreur de grille finale |
|---|---|---|---|---|
| House | 125 | 83,14 ✗ | 124,99 ✓ | 0 ms |
| Dance House | 125 | 130,55 ✗ | 124,99 ✓ | 0 ms |
| Electro | 126 | 98,42 ✗ | 125,99 ✓ | 0 ms |
| Pop | 120 | 127,99 ✗ | 120,00 ✓ | 0 ms |
| Hip-Hop | 90 | 90,66 ✓ | 90,01 ✓ | 0 ms |
| Techno | 128 | 130,67 ✗ | 128,01 ✓ | 46 ms |
| Dubstep | 140 | 72,18 ✗ | 70,00 (moitié exacte, gérée par le SYNC) | 0 ms à 140 BPM |
| Synthwave (Autre) | 108 | 110,14 ✗ | 108,00 ✓ | 0 ms |

Sur 8 morceaux techno supplémentaires, l'erreur de grille va de 0 à 58 ms. Les anciens tests synthétiques passent toujours (124, 93,5, 140 et 170 BPM retrouvés, premier temps à 10 ms près). Pour les 8 morceaux, les niveaux sont sains : crête à 0,95, aucun échantillon invalide, aucune seconde silencieuse. `npm run build` réussit et `npm test` donne 5 tests sur 5 réussis.

**Limites :**
- Avec une grosse caisse techno à long balayage, la grille peut rester décalée jusqu'à ~60 ms. Une synchro entre deux de ces morceaux peut donc nécessiter un ajustement à l'oreille (boutons − / +).
- Le dubstep est annoncé à 70 BPM au lieu de 140. Le SYNC gère ce rapport ×2, et le bouton ×2 permet de corriger l'affichage.

**Fichier de l'application modifié par cette demande :** `frontend-starter/src/app/shared/audio/track-analyzer.ts` (détecteur de BPM). Le backend n'est pas modifié.

### Résultat de la génération

- **400 morceaux MP3** générés en 51 minutes (559 Mo) dans `musiques-generees/` :

  | Dossier | Morceaux | Tempos |
  |---|---|---|
  | `01-house` | 50 | 120–126 BPM |
  | `02-dance-house` | 50 | 124–128 BPM |
  | `03-electro` | 50 | 125–130 BPM |
  | `04-pop` | 50 | 96–122 BPM |
  | `05-hip-hop` | 50 | 84–96 BPM |
  | `06-techno` | 50 | 126–136 BPM |
  | `07-dubstep` | 50 | 140 BPM |
  | `08-autre` | 50 | 75–174 BPM |

  Répartition de « Autre » : Trance 11, Synthwave 9, Drum & Bass 9, Reggaeton 8, Lo-fi 7, Afro House 6.
- Les 50 titres de chaque genre sont tous différents. Chaque fichier porte une étiquette ID3 : titre, artiste « Générateur TP Mixage », genre, BPM, tonalité.
- **Catalogue :** `musiques-generees/catalogue.csv` (ouvrable dans Excel) et `catalogue.json`. Pour chaque morceau : genre, sous-genre, titre, BPM, tonalité, gamme, structure, fichier, taille, graine.
- **Pour régénérer :** `cd outils/generateur-musique && npm install && node generer.mjs`. Option `--par-genre N` pour un essai rapide.

### Vérifications finales

- **400 MP3 sur 400 valides** (étiquette ID3 suivie d'une trame MP3 correcte).
- **Échantillon de 24 morceaux** (le 1er, le 25e et le 50e de chaque genre) passé dans le détecteur de BPM de l'application : **24 sur 24 au bon tempo**. Le dubstep est trouvé à 70 BPM, la moitié exacte, que le SYNC gère.
- **Grille des temps :**
  - 0 à 6 ms pour 16 morceaux sur 24 ;
  - techno : 46 à 75 ms ;
  - **décalée d'un demi-temps** pour 1 morceau hip-hop sur 3 (325 ms) et 2 dubstep sur 3 (à 140 BPM).

**Limites :**
- Pour ces morceaux, la synchro alignera les tempos, mais les temps peuvent être décalés : il faudra recaler à l'oreille avec les boutons − / +, ou avec les hot cues.
- Les morceaux sont synthétiques : instrumentaux, sans voix, au son électronique simple. Ils n'ont pas été écoutés par un humain pendant cette séance ; seules des mesures automatiques ont été faites (niveaux, tempo, validité des fichiers).
- Ils ne sont **pas importés** dans l'application. Pour les utiliser : onglet Backing tracks → Importer, ou glisser les fichiers.

**Fichiers ajoutés :** `outils/generateur-musique/` (`moteur.mjs`, `compositeur.mjs`, `generer.mjs`, `package.json`) et `musiques-generees/` (400 MP3 + catalogue).

**État :** terminé.

## Demande 10 — Les demandes récentes manquaient dans le rapport

> « Pourquoi je ne vois pas les prompts récents dans le fichier rapport IA ? J'ai dit que tout ce que je demande de faire, tu dois l'insérer dans le rapport, les uns à la suite des autres. »

**Ce qui n'allait pas :**
- La demande 9 n'avait pas encore été inscrite : l'IA attendait la fin du travail pour l'ajouter.
- Le journal était rangé du plus récent au plus ancien.
- Les demandes de discussion (1, 2, 7 et 8) n'avaient pas leur propre section.

**Ce qui a été changé :** le rapport est réorganisé dans l'**ordre chronologique**. Chaque demande est numérotée, citée, et suivie de ce qui a été fait. Toute nouvelle demande sera inscrite **dès sa réception**, avec l'état « en cours » si le travail n'est pas terminé.

## Demande 11 — Ajouter des morceaux depuis internet (en cours)

> « Dans mon appli de musique, j'ai déjà une liste de tracks où je peux ajouter mes propres fichiers. Ajoute la possibilité d'ajouter aussi des morceaux depuis internet, directement depuis cette liste. Prévois deux façons d'ajouter un morceau en ligne. La première : un champ où je colle l'adresse directe d'un fichier audio, avec un bouton d'ajout. La seconde : une recherche dans un catalogue de musique libre de droits, en commençant par l'API de Jamendo, avec la possibilité d'ajouter un autre catalogue plus tard. Lis d'abord la documentation officielle de l'API pour utiliser les bons paramètres et respecter ses conditions d'utilisation. La clé d'API ne doit jamais être écrite dans le code envoyé sur Git. Un morceau ajouté depuis internet doit se comporter exactement comme un morceau local : il apparaît dans la même liste, avec son titre, son artiste, sa source et sa licence affichés, et je peux le charger sur l'un ou l'autre des deux decks. Il doit marcher avec le scratch, l'égaliseur, les effets, la détection du BPM et la synchronisation. Pour cela, le fichier doit être téléchargé et décodé par le moteur audio, pas seulement lu dans une balise audio classique. Teste si le serveur qui héberge le fichier autorise cet accès (CORS). Si ce n'est pas le cas, dis-le-moi clairement et propose une solution simple, comme un petit serveur intermédiaire, avant de l'écrire. N'utilise ni Spotify, ni YouTube, ni aucun outil qui télécharge des morceaux protégés par des droits d'auteur. Gère proprement les cas d'erreur : lien invalide, format non pris en charge, téléchargement qui échoue, connexion lente. Affiche un indicateur de chargement et un message d'erreur compréhensible. Explique-moi simplement tes choix, je suis encore débutante sur ces sujets. Teste le résultat avant de me répondre. »

### 1. Documentation et conditions de Jamendo (lues avant d'écrire le code)

- **Méthode utilisée :** `GET https://api.jamendo.com/v3.0/tracks/` avec les paramètres :
  - `client_id` (obligatoire) ;
  - `format=json` ;
  - `limit` (200 au maximum) et `offset` ;
  - `search` ;
  - `audioformat=mp32` (MP3 de meilleure qualité que le format par défaut `mp31` à 96 kbit/s) ;
  - `imagesize` ;
  - `boost=popularity_total` (conseillé par la documentation pour garder la pertinence d'une recherche) ou `order=popularity_week` sans recherche.
- **Champs lus :** `name`, `artist_name`, `duration`, `audio`, `shareurl`, `license_ccurl`, `image`.
- **Conditions d'utilisation** ([devportal.jamendo.com/api_terms_of_use](https://devportal.jamendo.com/api_terms_of_use)) :
  - gratuit pour un usage **non commercial** ;
  - il faut **créditer les artistes et Jamendo** et mettre un **lien de retour vers chaque morceau** ;
  - les applications **ne doivent pas être conçues pour stocker les morceaux ni permettre une écoute hors ligne** ;
  - la clé est **personnelle**.
- **Conséquences dans l'application :**
  - artiste, licence et lien « Page Jamendo » sont affichés ;
  - la mention « Musique fournie par Jamendo » apparaît sous les résultats ;
  - les fichiers Jamendo ne sont **jamais copiés sur le serveur** : seule la référence est gardée, et l'audio est téléchargé en mémoire au moment de l'écouter ou de le mixer.

### 2. Tests CORS (avant d'écrire le code)

Requêtes envoyées avec l'en-tête `Origin: http://localhost:4200`, comme le ferait l'application :

| Serveur | Résultat |
|---|---|
| API Jamendo (`api.jamendo.com`) | ✅ `access-control-allow-origin: *` |
| Fichiers audio Jamendo (`prod-1.storage.jamendo.com`) | ✅ autorise `http://localhost:4200` |
| Wikimedia Commons (`upload.wikimedia.org`) | ✅ `access-control-allow-origin: *` |
| SoundHelix (`www.soundhelix.com`) | ❌ aucun en-tête CORS : le navigateur bloque |

**Conclusion :** aucun serveur intermédiaire n'est nécessaire pour Jamendo. Pour les liens directs, cela dépend du site. Quand le site refuse, l'application l'explique clairement. Un petit serveur intermédiaire a été **proposé à l'étudiante mais pas écrit**, en attente de sa décision.

### 3. Choix de conception (expliqués simplement)

- **Une « référence » plutôt qu'une copie.**
  - Ce que l'application garde : titre, artiste, source, licence, adresse du fichier. C'est rangé dans le navigateur, une liste par compte.
  - Pourquoi pas une copie sur le serveur : ce serait interdit par Jamendo, et il faudrait modifier le backend.
  - Quand l'audio est téléchargé : en mémoire, au moment du chargement sur un deck. Les 3 derniers fichiers restent en mémoire pendant la session.
- **Une seule liste.** Les morceaux en ligne apparaissent en tête de la première page de « Mes pistes » et de la bibliothèque du Mixage, avec un badge « En ligne », l'artiste, la source (cliquable) et la licence (cliquable).
- **Même moteur audio.** Le fichier téléchargé est décodé par `decodeAudioData`, exactement comme un fichier local. Scratch, égaliseur, effets, BPM et sync fonctionnent donc pareil.
- **Téléchargement avec `fetch`, sans le client HTTP d'Angular.** L'intercepteur de l'application ajoute le jeton de connexion (JWT) à toutes les requêtes. Avec `fetch` et `credentials: 'omit'`, ce jeton n'est jamais envoyé à Jamendo ni à un autre site.
- **Clé Jamendo hors de Git.** Deux façons de la fournir :
  - le fichier `frontend-starter/public/catalogs.local.json`, ajouté au `.gitignore` (modèle : `catalogs.local.example.json`) ;
  - la saisie dans l'application, gardée dans ce navigateur.
  
  Limite honnête : une clé utilisée par le navigateur reste visible dans les requêtes réseau. Pour la cacher complètement, il faudrait un serveur intermédiaire.
- **Prévu pour d'autres catalogues.** Interface `MusicCatalog` ; un nouveau catalogue = une nouvelle classe ajoutée à la liste de `CatalogService`.
- **Pas de musique protégée.** Les liens YouTube, Spotify, Deezer, SoundCloud, Apple Music, Tidal et Amazon Music sont refusés avec une explication.

### 4. Cas d'erreur gérés (message affiché à l'utilisatrice)

| Cas | Message |
|---|---|
| Texte qui n'est pas un lien | « Ce lien n'est pas une adresse web valide. Il doit commencer par https:// (ou http://). » |
| Lien YouTube, Spotify… | « … diffuse des morceaux protégés par le droit d'auteur : l'application ne les télécharge pas… » |
| Page web au lieu d'un fichier | « Ce lien ne semble pas mener à un fichier audio : c'est probablement une page web… copiez le lien direct du fichier… » |
| Site qui refuse le CORS | « Le serveur … répond, mais il n'autorise pas les autres sites à télécharger ce fichier (règle de sécurité CORS)… » |
| Serveur injoignable | « Impossible de joindre … Vérifiez le lien et votre connexion internet. » |
| Erreur HTTP (404, 403, 5xx…) | Raison en clair + code HTTP |
| Format non pris en charge | « Ce fichier n'est pas dans un format audio lisible par le navigateur… » |
| Fichier trop gros (> 60 Mo) | Taille et limite affichées |
| Connexion lente | Message « Connexion lente : le téléchargement continue… » ; abandon après 20 s sans aucune donnée reçue |
| Annulation | Bouton « Annuler » → « Téléchargement annulé. » |
| Doublon | « Ce morceau est déjà dans votre liste. » |
| Clé Jamendo absente ou refusée | Encadré expliquant comment obtenir la clé ; message « clé refusée » |

L'**indicateur de chargement** affiche la barre de progression, les Mo reçus sur le total, le débit, et le bouton Annuler. Sur les decks, « Téléchargement NN % » apparaît pendant le chargement.

### 5. Problèmes rencontrés pendant les tests et corrections

| Problème | Correction |
|---|---|
| Dans la première version de la fonction de téléchargement, l'erreur brute était **toujours** relancée : le diagnostic CORS (serveur joignable ou non) n'aurait jamais été atteint. Repéré à la relecture. | Séparation entre « annulé ou trop lent » (signalé tel quel) et les autres échecs, qui passent par le diagnostic. |
| Les formulaires **« clé Jamendo » et « recherche »** utilisaient `(ngSubmit)` sans être reliés à un groupe de formulaire Angular. L'événement ne se déclenchait pas et le navigateur **rechargeait la page** : la clé et la recherche étaient perdues. Découvert par le test dans le navigateur. | Les deux formulaires utilisent l'événement `submit` natif avec `preventDefault()`. |
| Une page web Wikipédia affichait le message CORS au lieu de dire que ce n'était pas un fichier audio. | Si un lien bloqué par CORS ne se termine pas par une extension audio, le message explique qu'il s'agit probablement d'une page web. |
| Erreur de typage TypeScript 6 (`Uint8Array` / `BlobPart`) au premier build. | Type précisé. |

### 6. Vérifications

- **Tests automatiques :** 17 tests sur 17 réussis, dont 12 nouveaux :
  - validation des liens ;
  - refus de YouTube et de Spotify ;
  - 404 ;
  - page HTML ;
  - CORS ou serveur injoignable ;
  - page web derrière un CORS ;
  - connexion bloquée ;
  - progression ;
  - noms de licences ;
  - paramètres envoyés à Jamendo et lecture de sa réponse ;
  - clé refusée.
- **Build :** `npm run build` réussit.
- **Navigateur réel** (Chrome piloté par script, **son coupé**) :
  - les 5 cas d'erreur du lien direct affichent le bon message ;
  - ajout d'un fichier Wikimedia réussi, doublon refusé ;
  - catalogue : l'encadré « clé » s'affiche, la requête vers l'API a les bons paramètres, les résultats s'affichent ;
  - ajout d'un morceau Jamendo avec indicateur « 41 % · 550 Ko / 1,3 Mo · 4,0 Mo/s » ;
  - « Mes pistes » et la bibliothèque du Mixage affichent titre, artiste, source et licence ;
  - écoute simple du morceau en ligne.
- **Morceau Jamendo sur le deck A :**
  - « Téléchargement 100 % », puis BPM détecté (115) ;
  - lecture ;
  - **SYNC** sur le deck B (pitch −11,91 %, 101,3 BPM) ;
  - **scratch** (0:02.9 → 0:01.0) ;
  - **égaliseur** : vumètre de 23 % → 9 % en coupant les trois bandes ;
  - **écho** réglé.
- **Connexion lente simulée (20 Ko/s) :** message « Connexion lente… » puis annulation réussie.

**Limite du test :** aucune vraie clé Jamendo n'était disponible. La réponse de l'API de recherche a été **simulée** dans le navigateur, avec le format décrit par la documentation. Les fichiers audio Jamendo, eux, ont bien été téléchargés réellement.

**Captures :** `captures/morceaux_en_ligne_liste.png`, `captures/morceaux_en_ligne_mixage.png`.

### 7. Fichiers

**Créés (frontend) :**
- `shared/catalogs/music-catalog.ts` et `jamendo-catalog.ts` (+ `.spec.ts`) ;
- `shared/audio/remote-audio.ts` (+ `.spec.ts`) et `online-audio-error.ts` ;
- `shared/services/online-track.service.ts`, `catalog.service.ts` et `catalog-keys.service.ts` ;
- le composant `components/online-track-add/` ;
- `frontend-starter/catalogs.local.example.json`.

**Modifiés (frontend) :**
- `shared/models/track.model.ts` : champ facultatif `online` ;
- `shared/services/dj-engine.service.ts` et `shared/audio/deck-engine.ts` : chargement des morceaux en ligne et progression ;
- `components/tracks-page/` : liste commune, carte « Ajouter depuis internet », lecture et retrait ;
- `components/dj-library/` et `components/dj-deck/dj-deck.html` ;
- `frontend-starter/.gitignore`.

**Non modifiés :** `backend/`, `API_CONTRACT.md`.

### 8. En attente de la décision de l'étudiante

Serveur intermédiaire pour les sites qui refusent le CORS (comme SoundHelix) : **proposé, pas écrit**.

**État :** terminé (hors serveur intermédiaire, en attente de décision).

## Demande 12 — Ajouter les musiques et les classer par catégories (en cours)

> « Je veux aussi ajouter la musique et classer la musique dans le backing track et mixage en fonction des catégories. Essaie de voir comment représenter le frontend de ça de façon jolie. »

### Choix expliqués simplement

- **Où ranger la catégorie sans modifier le backend ?**
  - Le backend ne stocke qu'un titre, et sa recherche filtre sur ce titre. La catégorie est donc écrite **en tête du titre enregistré**, entre crochets : `[House] Stellar Rooftop`.
  - L'application retire ce préfixe à l'affichage et le remplace par une pastille colorée.
  - Avantages : le classement est **conservé sur le serveur**, quel que soit l'ordinateur, et le filtre par catégorie utilise **la recherche existante du backend**, donc **la pagination serveur continue de fonctionner** (5 pistes par page dans Backing tracks, 8 dans le Mixage).
  - Les crochets évitent les confusions : `[House]` ne trouve pas `[Dance House]`.
- **Combiner catégorie et texte :** le backend ne prend qu'un seul texte de recherche. Il filtre donc sur le texte saisi, et la catégorie est vérifiée dans l'application. Dans ce cas, une page peut afficher moins de 5 pistes.
- **Compteurs :** une petite requête `GET /api/tracks?limit=1&search=[Catégorie]` par catégorie. Seul le total (`totalDocs`) est utilisé.
- **Catégories :** House 🏠, Dance House 💃, Electro ⚡, Pop 🎤, Hip-Hop 🎧, Techno 🤖, Dubstep 🔊, Autre 🌍. Chacune a sa couleur. Les morceaux importés avant ce changement s'affichent « 📁 Non classé ». Comme l'API ne permet pas de modifier une piste existante, il faut les réimporter pour les classer.

### Ce qui a été fait

- **Backing tracks :**
  - **grille de « bacs »** (tuiles colorées avec icône, nom et nombre de morceaux) ; un clic filtre la liste, un second clic l'annule ;
  - chaque carte porte une **bordure et une pastille** de la couleur de sa catégorie, et son icône quand il n'y a pas de pochette ;
  - **menu « Catégorie »** dans le formulaire d'import.
- **Nouvelle carte « Importer plusieurs morceaux »** :
  - choix d'un **dossier entier** ou de **plusieurs fichiers** ;
  - **classement automatique**, d'après le nom du dossier (`01-house`…) ou le genre écrit dans le MP3 (étiquette ID3, lue par le nouveau `id3-reader.ts`) ;
  - le titre vient aussi de l'étiquette ID3 ;
  - résumé par catégorie avant l'envoi, catégorie de secours pour les fichiers non reconnus ;
  - envoi par la route existante `POST /api/tracks` (3 à la fois), avec barre de progression et bouton Arrêter ;
  - les morceaux **déjà présents sont ignorés**, et ceux en erreur peuvent être relancés seuls.
- **Mixage :**
  - **barre de bacs** en pilules colorées avec compteurs, au-dessus de la bibliothèque ;
  - chaque morceau a son icône et une bordure de couleur ;
  - le deck affiche la catégorie du morceau chargé.
- **Morceaux en ligne (demande 11) :** un menu « Catégorie » a été ajouté au formulaire, et la catégorie est enregistrée dans leur fiche.
- **Import réel :** les 400 morceaux générés ont été importés **par l'interface**, sur le compte de démonstration. Résultat : 50 par catégorie, en 20 secondes, sans erreur. Le backend contient maintenant 404 fichiers (les 4 existants plus les 400).

### Problèmes rencontrés et corrections

| Problème | Correction |
|---|---|
| **Défaut de la demande 11 découvert ici :** en ajoutant le style du badge « En ligne », un remplacement automatique avait aussi modifié la règle CSS pour petits écrans (moins de 720 px) de la bibliothèque du Mixage. La poignée et le BPM n'étaient plus masqués sur mobile, et la ligne était mal disposée. | La règle pour petits écrans a été réécrite. Elle masque désormais l'icône de catégorie (qui remplace la poignée) et le BPM. |
| Un **test existant** vérifiait que la liste était chargée exactement 2 fois. Les compteurs de catégories utilisent la même route, ce qui portait le nombre d'appels à 20. | Le test ne compte plus que les chargements de la liste (limite 5). Le comportement vérifié reste le même : un chargement initial, puis un rechargement après l'envoi. |
| Sur la capture, le **menu « Catégorie »** du formulaire d'import était minuscule (style du navigateur). | Même style que les autres champs. |
| À la fin de l'import en lot, le bouton affichait encore « **Importer 400 morceau(x)** » alors que tout était envoyé. | Le bouton compte uniquement les morceaux restants et disparaît quand il n'y en a plus (« Terminer »). |
| Un fichier illisible affichait l'erreur technique « **Failed to fetch** ». | Message clair : « fichier illisible ou serveur injoignable ». |
| Les premiers essais d'import automatisé n'avaient sélectionné aucun fichier. | C'était une erreur du **script de test**, pas de l'application. Script corrigé. |

### Vérifications

- **Tests automatiques :** 23 tests sur 23 réussis, dont 6 nouveaux :
  - classement à partir d'un dossier ou d'un genre ID3 ;
  - préfixe ajouté au titre, puis retiré à l'affichage ;
  - House et Dance House non confondus ;
  - catégorie « Non classé » et morceaux en ligne ;
  - lecture d'une étiquette ID3 ;
  - fichier sans étiquette.
- **Build :** `npm run build` réussit.
- **Navigateur réel** (Chrome piloté par script, son coupé) :
  - 400 fichiers sélectionnés, puis détectés et classés à 50 par catégorie ;
  - import terminé (« 400 morceau(x) importé(s) ») ;
  - grille : Tous 404, et 50 dans chaque catégorie ;
  - filtres Dubstep et Dance House : uniquement la bonne catégorie, 10 pages de 5 ;
  - bac Techno du Mixage : uniquement du techno, 7 pages de 8 ;
  - « Savage Drive » chargé sur le deck A : catégorie affichée et 126 BPM détectés (valeur exacte) ;
  - réimport de 2 morceaux existants : « 2 déjà présent(s) », aucun doublon ;
  - aucune erreur console.

**Captures :** `captures/categories_backing_tracks.png` et `captures/categories_mixage.png`. Elles ont été prises avant les deux petites corrections visuelles (menu « Catégorie » et libellé du bouton d'import).

**Fichiers :**
- **Créés :**
  - `shared/models/category.model.ts` (+ `.spec.ts`) ;
  - `shared/audio/id3-reader.ts` ;
  - `shared/services/category-stats.service.ts` ;
  - le composant `components/bulk-import/`.
- **Modifiés :**
  - `tracks-page` (`.ts`, `.html`, `.css`, `.spec.ts`) ;
  - `dj-library` (`.ts`, `.html`, `.css`) ;
  - `dj-deck` (`.ts`, `.html`) ;
  - `online-track-add` (`.ts`, `.html`, `.css`) ;
  - `online-track.service.ts` et `track.model.ts` (champ `category`).
- **Non modifiés :** le code du backend et `API_CONTRACT.md`. Les 400 morceaux ont été ajoutés aux **données** du backend (fichiers dans `backend/data/uploads` et fiches dans MongoDB) par la route existante, comme l'aurait fait un utilisateur.

**État :** terminé.

## Demande 13 — Lecture automatique au chargement (en cours)

> « Au moment de lancer le mixage, je ne veux pas qu'à chaque fois on doive appuyer sur le start pour que le son se lance. Une fois qu'on a choisi le son pour le lecteur 1 et 2 depuis la catégorie, que ça se lance tout seul. »

### Ce qui a été fait

- **Démarrage automatique :** dès qu'un morceau choisi dans un bac (ou glissé sur une platine) est téléchargé et décodé, la platine **se met en lecture toute seule**. Il n'y a plus besoin d'appuyer sur ▶.
- **Pas d'attente :** la lecture démarre sans attendre la fin de l'analyse du tempo, qui continue en arrière-plan.
- **Règle du navigateur respectée :** un navigateur n'autorise un son qu'après un geste de l'utilisateur. Le clic sur « Charger A/B » (ou le glisser-déposer) compte comme ce geste : le moteur audio est activé à ce moment-là.
- **Interrupteur « Lecture automatique au chargement »** dans l'en-tête de l'onglet Mixage :
  - il est activé par défaut ;
  - on peut le couper pour préparer un morceau en silence (pour placer un repère avant de le lancer, par exemple) ;
  - le choix est retenu dans le navigateur.
- **Fichiers modifiés :** `shared/services/dj-engine.service.ts` (signal `autoPlay`, démarrage après décodage, préférence enregistrée), `components/mix-page/` (`.html`, `.css` : interrupteur). Le backend n'est pas modifié.

### Vérifications (Chrome piloté par script, son coupé)

1. Bac House → « Charger A », sans clic sur Lecture : la platine A joue (« Pause platine A », 0:02.6).
2. Bac Techno → « Charger B », sans clic sur Lecture : la platine B joue (0:02.4), et la platine A continue (0:08.9).
3. Interrupteur coupé → nouveau morceau sur A : il reste à l'arrêt, à 0:00.0, comme attendu.
4. Après rechargement de la page, l'interrupteur garde la position choisie.
5. Aucune erreur console ; `npm run build` réussit et les 23 tests passent.

**Capture :** `captures/lecture_automatique.png`.

**À noter :** pour mixer, il est souvent utile que le second morceau démarre avec le volume de sa voie baissé ou le crossfader du côté du premier, puis de l'amener progressivement. La lecture automatique ne touche ni aux volumes ni au crossfader.

**État :** terminé.

## Demande 14 — Icônes professionnelles (en cours)

> « Les icônes ajoutées ne sont pas des icônes professionnelles. Je veux que tu remplaces chaque icône ou emoji par des icônes professionnelles. »

### Ce qui n'allait pas

L'interface utilisait des **emojis et des symboles typographiques**. Leur rendu change selon le système (Windows, Mac, Android) et leurs styles sont disparates (couleurs, tailles), ce qui ne fait pas professionnel :
- navigation : ♫ 👤 🎧 ↩ ↪ ☀ ☾ ;
- catégories : 🏠 💃 ⚡ 🎤 🎧 🤖 🔊 🌍 📁 🎶 ;
- import en lot : 📂 🎵 ✓ ✗ → ;
- platines et lecture : ▶ ❚❚ ;
- pochette absente : ♪.

### Ce qui a été changé

- **Bibliothèque d'icônes Lucide** (`lucide` 1.48.0, licence ISC, open source, très utilisée dans les applications professionnelles) :
  - icônes vectorielles (SVG) au trait fin et homogène ;
  - nettes à toutes les tailles ;
  - de la couleur du texte qui les entoure, donc adaptées automatiquement au thème clair ou sombre.
- **Nouveau composant `<app-icon>`** (`components/icon/icon.ts`) qui dessine l'icône demandée. Registre `shared/icons/icons.ts` : seules les 25 icônes utilisées sont incluses dans l'application.
- **Correspondances :**

  | Élément | Avant | Icône Lucide |
  |---|---|---|
  | Logo | ♫ | Music |
  | Backing tracks | ♫ | ListMusic |
  | Mixage | 🎧 | SlidersVertical |
  | Profil | 👤 | User |
  | Connexion / Déconnexion | ↪ / ↩ | LogIn / LogOut |
  | Thème clair / sombre | ☀ / ☾ | Sun / Moon |
  | Tous | 🎶 | LibraryBig |
  | House | 🏠 | House |
  | Dance House | 💃 | Disc3 |
  | Electro | ⚡ | Zap |
  | Pop | 🎤 | MicVocal |
  | Hip-Hop | 🎧 | Headphones |
  | Techno | 🤖 | Cpu |
  | Dubstep | 🔊 | AudioWaveform |
  | Autre | 🌍 | Globe |
  | Non classé | 📁 | Folder |
  | Choisir un dossier / des fichiers | 📂 / 🎵 | FolderOpen / FileAudio |
  | Importé / en erreur | ✓ / ✗ | Check / X |
  | Lecture / Pause | ▶ / ❚❚ | Play / Pause |
  | Pas de pochette | ♪ | Music, ou l'icône de la catégorie |

- **Menus déroulants** (choix de la catégorie) : une liste déroulante ne peut pas afficher d'icône dessinée, donc les emojis y ont été retirés et seul le nom reste.
- **Accessibilité :** les icônes sont décoratives (`aria-hidden`). Le sens reste porté par le texte voisin ou par l'`aria-label` des boutons.

**Fichiers :**
- **Créés :** `components/icon/icon.ts`, `shared/icons/icons.ts`.
- **Modifiés :**
  - `shared/models/category.model.ts` (noms d'icônes au lieu d'emojis) ;
  - `components/app/` (`.ts`, `.html`) ;
  - `tracks-page`, `bulk-import`, `dj-library`, `dj-deck` et `online-track-add` (`.ts`, `.html`) ;
  - `frontend-starter/package.json` et `package-lock.json` (ajout de `lucide`).
- **Non modifiés :** le backend.

### Vérifications

- Recherche automatique dans tout le code de l'application : **aucun emoji ni symbole restant** (hors commentaires).
- `npm run build` réussit, sans nouvel avertissement. `npm test` : 23 tests sur 23 réussis.
- **Navigateur** (Chrome, son coupé) :
  - 33 icônes dessinées sur Backing tracks et 27 sur Mixage, aucune vide ;
  - rendu vérifié en thème clair et en thème sombre ;
  - Lecture et Pause correctement affichés sur les platines ;
  - aucune erreur console.
- **Captures :** `captures/icones_backing_tracks.png`, `captures/icones_mixage_bibliotheque.png`, `captures/icones_mixage_platines.png`.

**Remarque (non corrigée, hors demande) :** en thème sombre, le fond de la page reste clair autour des cartes. La cause vient du style d'origine de l'application : la règle `.app-shell { background: … }` de `app.css` l'emporte sur la règle du thème sombre de `styles.css`. Ce n'est pas lié aux icônes ; correction possible sur demande.

**État :** terminé.

## Demande 15 — Onglet Audio (en cours)

> « Je veux également que tu ajoutes un onglet Audio où on aura la possibilité d'écouter juste du son, avec également l'intégration d'un Butterchurn qui suit le rythme de la musique. On doit pouvoir gérer la vitesse de lecture de la musique, régler le volume, et une possibilité de mettre en arrière-plan. »

### Interprétation de « mettre en arrière-plan »

La demande pouvait vouloir dire deux choses. Les deux ont été faites :
1. **La musique continue en arrière-plan** quand on change d'onglet de l'application. Un **mini-lecteur** apparaît alors dans la barre du haut (lecture/pause, suivant, retour à l'onglet Audio). Les **touches multimédia** du clavier, du casque ou de l'écran de verrouillage du téléphone pilotent aussi le lecteur (API Media Session).
2. **Les visuels peuvent passer en fond d'écran**, derrière le lecteur et la liste, comme dans le Mixage, ou rester dans un **cadre** au-dessus du lecteur.

### Ce qui a été fait

- **Onglet « Audio »** (route `/audio`, chargée à la demande et protégée), avec un lien dans la barre de navigation.
- **Lecteur :**
  - pochette ou icône de catégorie, titre, artiste ;
  - barre de progression cliquable ;
  - lecture/pause, précédent (qui revient au début du morceau après 3 s), suivant ;
  - aléatoire, et répétition de la liste, du morceau ou aucune ;
  - enchaînement automatique des morceaux.
- **Vitesse de lecture** de 0,5× à 2× : curseur, raccourcis 0,75× / 1× / 1,25× / 1,5×, double-clic pour revenir à 1×. Option **« Conserver la tonalité »**, activée par défaut : la musique va plus vite sans devenir aiguë.
- **Volume :** curseur avec une courbe adaptée à l'oreille, et bouton muet.
- **Réglages retenus :** volume, vitesse et tonalité sont gardés dans le navigateur.
- **Liste des morceaux :** recherche, catégories (mêmes pilules colorées que le Mixage), pagination. Le morceau en cours est mis en évidence par un petit égaliseur animé. La liste affichée devient la file d'attente.
- **Butterchurn** branché sur le son du lecteur, **avant le volume** : les visuels suivent le rythme même à faible volume. Choix du preset, aléatoire, changement automatique toutes les 30 s, cadre ou fond d'écran, plein écran.
- **Raccourcis clavier :** Espace (lecture/pause), ← → (reculer ou avancer de 5 s).
- **Déconnexion :** le lecteur s'arrête.

### Choix techniques (expliqués simplement)

- **Service partagé (`AudioPlayerService`)** : le lecteur ne dépend pas de la page. C'est ce qui permet à la musique de continuer quand on change d'onglet.
- **Chaîne audio :** balise `<audio>` → analyse par Butterchurn → volume → haut-parleurs. La vitesse utilise `playbackRate` et la tonalité `preservesPitch`, deux réglages fournis par le navigateur.
- **Visualiseur existant réutilisé :** il accepte maintenant une autre source sonore et un mode « cadre ». Le comportement du Mixage reste le même.
- **Préchargement discret des visuels** pendant que le navigateur est inactif, pour que le bouton « Activer les visuels » réagisse tout de suite.

### Problèmes rencontrés et corrections

| Problème | Correction |
|---|---|
| Erreur de compilation : la référence de gabarit `#page` portait le même nom que le signal `page()` (numéro de page). | Référence renommée `#audioPage`. |
| Les tests du lecteur passaient, mais avec 4 erreurs « non gérées » : l'environnement de test (jsdom) ne sait pas créer d'URL temporaire pour un fichier. | Cette fonction est simulée dans le test, qui est maintenant propre. |
| Dans le Chrome de test, **les visuels mettaient 30 à 46 s à démarrer** avec de la musique (4,5 à 5,5 s sans). Deux pistes ont été examinées puis écartées : le moteur audio qui ne redémarrait pas, puis la lenteur du mode développement (même délai en production). Le profileur a montré que le temps passait dans le dessin des images, parce que ce Chrome de test n'utilise **pas de carte graphique** (rendu logiciel SwiftShader). | Mesure refaite **avec la carte graphique réelle (Intel Iris Xe)** : **0,6 à 1,1 s**. Ce n'était donc pas un défaut de l'application. Le préchargement des visuels a été ajouté au passage. La modification de la première piste (ne plus attendre la reprise du moteur audio) a été conservée, car elle est sans risque. |
| **En mode fond d'écran, l'animation restait enfermée dans le panneau du lecteur** (690×536 au lieu de toute la fenêtre). Le flou d'arrière-plan (`backdrop-filter`) des panneaux faisait du panneau le référentiel du canvas en position fixe, le même mécanisme que le `transform` corrigé à la demande 5. | Flou retiré des panneaux de l'onglet Audio, remplacé par un fond plus opaque. Le canvas couvre maintenant toute la fenêtre (1367×904). |
| Le mini-lecteur prenait trop de place et faisait passer « Backing tracks » sur deux lignes. | Mini-lecteur compacté. Sur une fenêtre de largeur moyenne, seuls l'icône et les boutons restent, et le titre complet apparaît au survol. **Cette version compacte n'a pas été re-capturée.** |

### Vérifications

- **Tests automatiques :** 30 tests sur 30 réussis, dont 7 nouveaux pour le lecteur :
  - vitesse bornée entre 0,5× et 2× et retenue ;
  - volume et mode muet ;
  - modes de répétition ;
  - enchaînement des morceaux et arrêt en fin de liste ;
  - « précédent » après 3 s ;
  - arrêt à la déconnexion.
- **Build :** `npm run build` réussit.
- **Navigateur** (Chrome, son coupé, version de production et carte graphique réelle) :
  - lien « Audio » dans la navigation ;
  - lecture d'un morceau Hip-Hop ; titre et catégorie transmis aux touches multimédia ;
  - **vitesse : à 1,5×, 6 s de musique en 4 s réelles ; à 1×, 4 s en 4 s** ;
  - volume réglé à 30 %, bouton muet fonctionnel ;
  - visuels prêts en 0,6 s ; en cadre, le canvas fait exactement la taille du cadre (658×370) ; en fond d'écran, il couvre toute la fenêtre et les panneaux deviennent translucides ;
  - **arrière-plan :** sur l'onglet Backing tracks, la musique continue (5 s de musique pour 4,3 s réelles, en comptant le petit temps de chargement de la page) ; le mini-lecteur affiche le titre ; sa touche pause fonctionne ; le retour à l'onglet Audio conserve le morceau, la position et les réglages ;
  - aucune erreur console.
- **Captures :** `captures/audio_visuels_cadre.png`, `captures/audio_visuels_fond_ecran.png`, `captures/audio_mini_lecteur.png` (cette dernière avant le compactage du mini-lecteur).

### Fichiers

- **Créés :**
  - `shared/services/audio-player.service.ts` (+ `.spec.ts`) ;
  - `components/audio-page/` (`.ts`, `.html`, `.css`) ;
  - `components/mini-player/mini-player.ts`.
- **Modifiés :**
  - `components/dj-visualizer/` (source sonore configurable, mode cadre ou fond d'écran, préchargement) ;
  - `shared/icons/icons.ts` (12 icônes du lecteur) ;
  - `routes.ts` (route `/audio`) ;
  - `components/app/` (`.ts`, `.html` : lien « Audio » et mini-lecteur).
- **Non modifiés :** le backend.

**Limites :**
- Si on lance aussi un mix dans l'onglet Mixage, les deux sons se superposent : le lecteur et la table de mixage sont indépendants.
- La file d'attente se limite à la page de morceaux affichée (10 morceaux).

**État :** terminé.

## Demande 16 — Erreur de connexion au login (en cours)

> « Pourquoi j'ai une erreur de connexion lors du login ? »

### Diagnostic

1. **Frontend Angular** (port 4200) : en marche (HTTP 200).
2. **Backend** (port 3000) : **injoignable**. Aucun processus n'écoutait sur ce port : le serveur n'était plus lancé (terminal fermé, ordinateur redémarré ou arrêt du processus).
3. **Conséquence :** la page de connexion envoie `POST /api/auth/login` au serveur Angular, qui la transmet (proxy) au backend. Comme le backend était absent, le proxy a répondu **HTTP 502**, et la page affiche alors son message générique « Erreur de connexion ». Les identifiants n'étaient pas en cause.

### Correction

- Backend relancé avec `npm start` dans le dossier `backend/`.
- Journal de démarrage :
  - connexion à MongoDB Atlas réussie ;
  - base `guitar-practice-cloud` prête ;
  - compte de démonstration présent.
- Vérifications : `GET /api/health` → `{"status":"ok"}`, puis `POST /api/auth/login` via l'application → **HTTP 200**.

### À retenir

- Pour que l'application fonctionne, **deux serveurs** doivent tourner :
  - `cd backend && npm start` (API, port 3000) ;
  - `cd frontend-starter && npm start` (Angular, port 4200).
- Si le login affiche « Erreur de connexion » alors que le mot de passe est bon, vérifier d'abord que le backend tourne : `http://localhost:3000/api/health` doit répondre `{"status":"ok"}`.
- Le backend relancé ici tourne dans la session de l'assistant IA. Si cette session se ferme, il faut le relancer soi-même avec la commande ci-dessus.

**Amélioration possible (non faite, à valider) :** la page de connexion affiche le même message générique quel que soit le problème. Elle pourrait distinguer « serveur injoignable » (HTTP 0 ou 502) de « identifiants incorrects » (HTTP 401).

**Fichiers modifiés :** aucun, à part ce rapport.

**État :** terminé.

## Demande 17 — Mission « MOST VIBE » (14 octobre 2026, en cours)

> Mission complète (résumé fidèle du texte fourni) : transformer le projet en **MOST VIBE**, un mini réseau social de partage de fichiers audio (musiques, mixages, remixes). Règles : analyser l'existant et présenter un plan avant toute modification ; garder ce qui fonctionne (mixage, lecture, sauvegarde, export) ; ne perdre aucune donnée, avec des migrations réversibles ; enregistrer toutes les données en base, pas seulement dans le navigateur ; vérifier les droits d'accès côté serveur, y compris pour les liens directs vers les fichiers. Sections :
> 1. Identité visuelle : nom MOST VIBE, logo MV, couleurs `#007FFF`, `#A99BEF`, `#F5FAFF`, `#FFFFFF`, `#18324F`, suppression du bleu marine.
> 2. Navigation verticale sur ordinateur, barre adaptée sur mobile, lecteur persistant.
> 3. Accueil, découverte et recherche publics sans compte : styles, sections, recherche filtrée sur les contenus autorisés.
> 4. Comptes et espace personnel ; action sociale reprise automatiquement après la connexion.
> 5. Visibilité Privé, Amis choisis ou Public ; gestion et retrait des accès.
> 6. Amis (invitations, blocage) et fil d'activité filtré.
> 7. Messagerie entre amis, compteur de non-lus, carte musicale, « Partage interrompu ».
> 8. Mixages en brouillon, remix soumis à autorisation, crédits en chaîne non modifiables.
> 9. Paramètres (profil, confidentialité, notifications, bloqués, suppression du compte).
> 10. Administration sans accès aux contenus privés.
> 11. Playlists, notifications, signalements, états vides, de chargement et d'erreur.
> 12. Tests avec 3 comptes A, B, C.
> 13. Livrables : bilan, tests y compris les échecs, services à configurer, étapes de mise en ligne.
>
> Faire un point après chaque grande partie. « Et mets à jour le fichier RAPPORT_IA avec la date. »

### Étape 1 — Analyse de l'existant (14/10/2026)

| Élément | État constaté |
|---|---|
| **Technologies** | Frontend Angular 22 (signals, composants autonomes). Backend Node.js avec Express 5 et Mongoose 9, base MongoDB Atlas. |
| **Authentification** | JWT (2 h) et bcrypt. Pas de rôles. |
| **Base de données** | `users` : 1 compte (démo). `tracks` : 404 pistes, toutes au compte démo. |
| **Stockage** | Disque local `backend/data/uploads` : 404 fichiers, 585 Mo. |
| **Droits** | Piste privée à son propriétaire, vérifié par le serveur. Ni public, ni amis, ni partage. |
| **API** | 10 routes (santé, auth, profil, pistes). |
| **Données seulement dans le navigateur** | Catégorie (préfixe du titre), morceaux en ligne, BPM et repères. À passer en base. |
| **Fonctions existantes à garder** | Lecteur Audio persistant, Butterchurn, table de mixage, import en lot, export d'un mix en `.webm`. |
| **Tests** | 30 tests frontend, 4 tests backend. |

### Décisions de l'étudiante (14/10/2026)

1. **Le backend peut être modifié** pour cette mission. Cela remplace la règle « ne jamais modifier le backend », qui valait pour les demandes 1 à 16. Chaque route ajoutée ou changée sera documentée dans `API_CONTRACT.md`.
2. **Styles regroupés :**
   - House, Dance House, Techno, Dubstep → électro ;
   - Hip-Hop → hip-hop ;
   - Pop → pop ;
   - Autre → autres ;
   - les styles afro, jazz et rock sont ajoutés ;
   - l'ancien style est conservé dans un champ à part, ce qui rend la migration réversible.
3. **Tests automatiques** sur une **base séparée** du même cluster Atlas : les vraies données ne sont jamais touchées.

### Plan validé

0. Branche Git `most-vibe`, sauvegarde complète de la base, système de migrations réversibles.
1. Sections 1 à 3 : identité visuelle, navigation, lecteur persistant, contenus publics, recherche.
2. Sections 4 et 5 : comptes, espace personnel, likes et favoris, visibilité et accès.
3. Sections 6 et 7 : amis, fil d'activité, messagerie.
4. Sections 8 à 10 : mixages, remix et crédits, paramètres, administration.
5. Sections 11 à 13 : notifications, signalements, tests A/B/C, livrables.

Un point avec l'étudiante est prévu à la fin de chaque étape.

### Précision de l'étudiante (14/10/2026)

> « L'onglet Backing tracks, Mixage et le contenu doivent encore y être, on ajoute juste ce que je t'ai donné. »

**Conséquence :** les onglets **Backing tracks**, **Audio** et **Mixage** restent, avec tout leur contenu. Les entrées de la mission (Accueil, Explorer, Ma bibliothèque, Amis, Messages, Paramètres) sont **ajoutées** au menu. Le « Studio de mixage » de la mission correspond à l'onglet Mixage existant.

### Étape 0 — Sécurité (14/10/2026)

- **Branche Git `most-vibe`** créée : `main` reste intacte. Rien n'a été commité, en attente de l'accord de l'étudiante.
- **Sauvegarde complète de la base :** `npm run backup` (405 documents) dans `backend/backups/2026-10-14T13-16-50-747Z/`, dossier ignoré par Git. Restauration possible avec `npm run restore -- backups/<date> --oui`.
- **Migrations réversibles :**
  - `backend/src/migrations/` (une fonction `up` pour appliquer, une fonction `down` pour annuler) ;
  - collection `migrations` pour ne jamais rejouer une migration deux fois ;
  - commandes `npm run migrate`, `npm run migrate -- status` et `npm run migrate -- down`.
- **Répétition générale sur une copie de la base** avant d'appliquer la migration à la vraie :
  - appliquée, puis relancée sans effet ;
  - annulée, avec une base **identique à l'original** ;
  - la copie a ensuite été supprimée.

### Étape 1 — Sections 1 à 3 (14/10/2026)

**Base de données (migration 001, appliquée à la vraie base) :**
- la catégorie cachée dans le titre devient un champ `style` (regroupement décidé) ;
- ajout de `visibility` (privé par défaut), `tags`, `album`, `kind` et du rôle utilisateur ;
- **vérification après migration :** 1 compte et 404 pistes, **0 fichier audio manquant**, les 404 titres d'origine conservés (annulation possible), toutes les pistes **privées** ;
- styles : électro 250, hip-hop 50, pop 50, autres 54.

**Backend :**
- `constants.js` (styles, visibilités, rôles) ;
- `access.js` : règle d'accès « propriétaire ou public », appliquée à chaque requête ;
- `routes/public.js` : accueil, recherche, fiche d'une piste ;
- authentification facultative pour les visiteurs ;
- `PATCH /tracks/:id` (propriétaire seulement) ;
- audio et pochettes protégés y compris en lien direct : **401** pour un visiteur, **403** pour un autre utilisateur, lecture partielle `Range` conservée ;
- variable facultative `MONGODB_DB` pour lancer le backend sur une autre base (démonstration, tests) ;
- toutes les routes sont documentées dans `API_CONTRACT.md`.

**Frontend :**
1. **Identité visuelle :**
   - nom MOST VIBE, logo MV ;
   - variables de thème `--mv-primary #007FFF`, `--mv-secondary #A99BEF`, `--mv-bg #F5FAFF`, `--mv-card #FFFFFF`, `--mv-text #18324F`, plus quelques nuances dérivées ;
   - environ 380 couleurs codées en dur remplacées par ces variables dans tous les écrans : navigation, boutons, lecteur, table de mixage (platine A en azur, platine B en violet), onglet Audio ;
   - plus de vert sombre ni de bleu marine ; le thème sombre utilise des gris neutres.
2. **Navigation :**
   - menu vertical (Accueil, Explorer, Ma bibliothèque, Backing tracks, Audio, Mixage, Amis, Messages, Paramètres), plus Mon profil, Déconnexion et thème ;
   - sur mobile, barre du bas (Accueil, Explorer, Biblio, Mixage, Plus) ;
   - **lecteur persistant** en bas de l'écran, qui remplace le mini-lecteur ;
   - les onglets **Backing tracks, Audio et Mixage sont conservés avec tout leur contenu**, comme demandé.
3. **Accueil et Explorer, accessibles sans compte :**
   - styles avec le nombre de pistes publiques ;
   - ajouts récents, sélection, mixages de la communauté, albums ;
   - cartes avec pochette, titre, style et auteur ;
   - recherche par titre, auteur, style, album et tag, avec filtres type et tri ;
   - les filtres apparaissent dans l'adresse, ce qui permet de partager une recherche ;
   - écrans vides avec une action proposée, messages d'erreur clairs, indicateurs de chargement.
- Envoi d'une piste : choix du **style** et de la **visibilité** (Privé par défaut). « Amis choisis » est visible mais désactivé jusqu'à l'étape 2.
- Écrans d'attente pour Ma bibliothèque, Amis, Messages et Paramètres : ils indiquent à quelle étape la fonction arrive et proposent une action utile.

### Problèmes rencontrés pendant l'étape 1 et corrections

| Problème | Correction |
|---|---|
| Un test backend existant vérifiait un détail de l'ancienne implémentation (la requête filtrait par propriétaire). | Le test vérifie maintenant le comportement attendu : propriétaire 200, autre utilisateur 403, visiteur 401, piste publique 200. |
| **Le filtre par auteur ne trouvait jamais rien.** La bibliothèque de pagination (`mongoose-aggregate-paginate-v2`) déplace automatiquement les filtres `$match` au début du pipeline, donc avant la jointure qui ajoute le nom de l'auteur. | Option `useFacet: false` sur la recherche publique, avec un commentaire qui l'explique. Un test d'intégration le vérifie. |
| Le test frontend des catégories vérifiait l'ancien préfixe dans le titre. | Réécrit pour les 7 styles et le regroupement décidé. |
| Deux erreurs de typage TypeScript (données de route, somme des styles). | Corrigées. |
| Le curseur du crossfader avait pris la couleur du texte au lieu du bleu de la charte. | Couleur principale appliquée. |

### Vérifications de l'étape 1

- **Backend :** 9 tests sur 9 réussis, dont 5 nouveaux tests d'intégration sur la base séparée `most-vibe-test` :
  - la recherche ne renvoie jamais de piste privée, même pour son propriétaire ;
  - recherche par titre, auteur, style, album et tag ;
  - l'email de l'auteur n'est jamais exposé ;
  - l'accueil ne contient que des contenus publics ;
  - lien direct : public 200, privé 401 pour un visiteur, 403 pour un autre utilisateur, 200 pour le propriétaire ; `Range` → 206 ;
  - seul le propriétaire modifie une piste, et une piste remise en privé disparaît aussitôt de la recherche.
- **Frontend :** 32 tests sur 32, dont 6 nouveaux.
- **Build :** `npm run build` réussit.
- **Navigateur** (version de production, son coupé, base de démonstration séparée `most-vibe-demo` avec 3 comptes et 9 pistes, dont 2 privées) :
  - **visiteur sans compte :** menu réduit à Accueil et Explorer ; variables de thème correctes ; aucune piste privée visible ; lecture d'une piste publique ; **le lecteur continue en changeant de page** ;
  - **recherche :** « secrète » et « brouillon » (pistes privées) donnent 0 résultat ; style, auteur, album, tag et mixages renvoient les bons résultats ;
  - **liens directs :** public 200 ; privé 401 pour un visiteur, 403 pour Bob, 200 pour Alice ;
  - **Alice connectée :** menu complet ; formulaire d'envoi avec Privé par défaut ; badges Privé et Public ; Mixage, Audio et Ma bibliothèque s'affichent ;
  - **aucune ancienne couleur à l'écran** (vérification automatique sur Accueil, Backing tracks, Mixage et Audio) ;
  - **mobile (390 px) :** pas de menu vertical, barre du bas, menu « Plus », 0 px de débordement ;
  - aucune erreur console.
- **Captures :** `captures/most_vibe_etape1_*.png` (accueil, explorer, backing tracks, mixage, audio, mobile).

### Limites et points en attente

- **Les 404 pistes de l'étudiante sont toutes privées :** l'accueil réel affiche donc « Aucun contenu public pour le moment ». Pour en publier, il suffit de choisir « Public » à l'envoi. La modification de la visibilité d'une piste existante dans l'interface arrive à l'étape 2 (section 5) ; la route `PATCH` existe déjà.
- **Base de démonstration `most-vibe-demo`** (3 comptes, mot de passe `MotDePasse123`) conservée pour revoir l'étape. Elle a ajouté 9 copies de morceaux `demo-*.mp3` dans `backend/data/uploads`. Les deux peuvent être supprimés sur demande.
- **Les morceaux ajoutés depuis internet** (demande 11) sont encore gardés dans le navigateur. Leur passage en base est prévu à l'étape 2, conformément à la règle « toutes les données en base ».
- **Rien n'a été commité :** les changements sont sur la branche `most-vibe`, en attente de validation.

**État :** étape 1 (sections 1 à 3) terminée. **Point avec l'étudiante** avant de passer aux sections 4 et 5.

## Demande 18 — MOST VIBE, étape 2 : sections 4 et 5 (14/10/2026)

> « 1 » (réponse au point d'étape : « Je continue ? »)

**Interprétation :** continuer avec les sections 4 (comptes et bibliothèque) et 5 (visibilité et partage). Les deux autres questions du point d'étape sont restées sans réponse, donc par prudence :
- **aucun commit** n'est fait ;
- **la base de démonstration est conservée**.

**Plan de l'étape 2 :**
- **Section 4 :**
  - espace personnel « Ma bibliothèque » : profil, fichiers, albums, playlists, favoris, projets de mixage ;
  - likes et favoris enregistrés en base ;
  - un visiteur qui like ou met en favori est invité à se connecter, puis **l'action est exécutée automatiquement après la connexion** ;
  - les morceaux ajoutés depuis internet passent du navigateur à la base (règle « toutes les données en base »).
- **Section 5 :**
  - visibilité Privé, Amis choisis ou Public, à l'envoi et à tout moment ;
  - liste des personnes qui ont accès, retrait d'un accès ;
  - message indiquant qu'un fichier déjà téléchargé ne peut pas être récupéré à distance ;
  - droits vérifiés par le serveur à chaque requête.

### Ce qui a été fait

#### Backend (autorisé le 14/10/2026)

| Élément | Détail |
|---|---|
| Nouveaux modèles | `Reaction` (j'aime / favori), `TrackAccess` (accès donnés à une personne, avec date de retrait), `Playlist`, `ExternalTrack` (morceaux en ligne) |
| Règle d'accès | `access.js` → `canRead` : propriétaire, **ou** piste publique, **ou** accès actif. Appliquée à l'audio, à la pochette et à la fiche, **à chaque requête** |
| Nouvelles routes | `routes/library.js` : j'aime / favoris, `/me/reactions`, `/me/favorites`, `/me/shared`, `/me/albums`, accès d'une piste (voir, donner, retirer), recherche de profils, playlists, morceaux en ligne |
| Routes modifiées | `PATCH /tracks/:id` : repasser en Privé retire les accès « Amis choisis » ; `DELETE /tracks/:id` : efface aussi réactions, accès et entrées de playlist ; routes publiques : `likeCount` en plus |
| Migration 002 | Crée les 4 collections et leurs index. **Annulation sans perte** : une collection non vide est renommée, jamais effacée |
| Base réelle | Sauvegarde `backend/backups/2026-10-14T13-33-18-390Z` (406 documents), **puis** migration 002 appliquée |
| Documentation | `API_CONTRACT.md` : section « MOST VIBE — étape 2 » (méthode, URL, auth, corps, réponses, erreurs de chaque route) |
| Sécurité | La recherche de profils ne renvoie que le nom, jamais l'email ; seule la propriétaire gère les accès (sinon 404, sans révéler que la piste existe) |

#### Frontend

| Élément | Détail |
|---|---|
| Ma bibliothèque (`/library`) | Onglets : Mes fichiers (avec visibilité), Albums, Playlists, Favoris, Partagés avec moi, Projets de mixage (étape 4), Profil. Chaque onglet a un état de chargement, un message d'erreur avec « Réessayer » et un état vide utile |
| J'aime, favori, playlist | Boutons sur chaque tuile et dans le lecteur persistant ; ajout à une playlist (ou création) depuis un petit menu |
| Visiteur | Un clic sur J'aime ou Favori mène à la connexion avec le bandeau « Connectez-vous pour aimer « … » » ; **l'action est faite automatiquement** juste après, puis retour à la page d'origine avec le message « C'est fait » |
| Visibilité et partage | Fenêtre : Privé / Amis choisis / Public, recherche d'une personne par son nom, liste de qui a accès, retrait avec confirmation, puis message « un fichier déjà téléchargé ne peut pas être récupéré à distance » |
| Envoi | Option « Amis choisis » activée ; après l'envoi, la fenêtre de partage s'ouvre pour choisir les personnes |
| Morceaux en ligne | Enregistrés **en base** (plus dans le navigateur). L'ancienne liste du navigateur est envoyée **une seule fois** au serveur, puis effacée du navigateur seulement si le serveur l'a acceptée |
| Pochettes privées | Nouveau composant qui les charge avec le jeton de connexion (une simple image ne l'envoie pas) |
| Connexion | Une page protégée ouverte sans être connecté renvoie vers cette même page après la connexion |

**Onglets existants conservés :** Backing tracks, Audio et Mixage gardent tout leur contenu. Backing tracks reçoit seulement un bouton « Partager ».

### Tests

| Tests | Résultat |
|---|---|
| Backend `npm test` (dont 9 nouveaux tests d'intégration avec les comptes A, B et C sur la base séparée `most-vibe-test-library`) | **18/18** |
| Frontend `npm test` (dont 6 nouveaux) | **38/38** |
| Build de production | OK, sans avertissement Angular |
| Test navigateur (Chrome sans fenêtre et **muet**, base de démonstration) | **38/38** : action après connexion, favoris, playlists, partage puis retrait (Bob 200 → 403, Chloé 403, visiteur 401), « Partagés avec moi », envoi « Amis choisis », reprise des morceaux en ligne, mobile 400 px sans débordement, aucune erreur JavaScript |

Captures : `captures/most_vibe_etape2_*.png` (10 images).

### Défauts trouvés pendant les tests, et corrections

| Ce qui n'allait pas | Ce qui a été changé |
|---|---|
| **Migration 001 :** rejouée sur la base de démonstration (créée après MOST VIBE), elle a remplacé le style des 9 pistes de démo par « autres ». Elle déduisait toujours le style du préfixe du titre, même si un style existait déjà. La vraie base n'était pas concernée (ses pistes n'avaient pas encore de style) | La migration garde maintenant un style déjà présent. Les 9 styles de démo ont été restaurés à partir du script de démonstration |
| **Migration 002 :** première version refusée par MongoDB (« Index already exists with a different name »). J'avais donné aux index des noms personnalisés, alors que Mongoose les avait déjà créés avec les noms par défaut | La migration utilise les noms par défaut de MongoDB, identiques à ceux de Mongoose |
| **Bouton J'aime (test navigateur) :** juste après la connexion, le cœur pouvait rester vide alors que le « j'aime » était bien en base. Une relecture des réactions, partie pendant l'envoi du « j'aime », revenait avec l'ancien état et l'écrasait | Une relecture est ignorée si une action était en cours à son départ ou à son retour, ou si une action a commencé entretemps. Un test unitaire couvre ce cas |
| **Fenêtre de partage :** la confirmation positive (« Bob peut maintenant écouter… ») avait l'icône et la couleur d'un avertissement | Coche et fond bleu clair pour une confirmation ; l'avertissement reste réservé aux retraits d'accès |
| **Test de pochette existant** (`api.test.js`) : il ne simulait pas la nouvelle vérification des accès, et aurait attendu une base non connectée | Le test simule `TrackAccess.exists` |

### Choix à connaître

- **« Amis choisis » avant la section 6 :** la liste d'amis n'existe pas encore. Pour l'instant, on peut donc choisir n'importe quel compte, en cherchant son **nom**. À l'étape 3, ce choix sera limité aux amis.
- **Accès par message :** une piste privée envoyée dans un message (section 7) donnera accès à son destinataire seul. La règle d'accès le prévoit déjà (`via: message`). Repasser une piste en Privé ne retire que les accès « Amis choisis ».
- **Trace des retraits :** un accès retiré reste listé avec sa date de retrait.

### Petit reste à nettoyer

Un fichier de test `D:\tmp-test.log` a été créé par erreur à la racine du disque D:. La protection de l'outil a bloqué sa suppression automatique : vous pouvez le supprimer à la main.

**Fichiers créés :**
- backend : `src/models/Reaction.js`, `TrackAccess.js`, `Playlist.js`, `ExternalTrack.js` ; `src/routes/library.js` ; `src/migrations/002-library-access.js` ; `test/most-vibe-library.test.js` ;
- frontend : `components/library-page/*`, `share-dialog`, `reaction-buttons`, `cover-image` ; `shared/services/library.service.ts`, `reactions.service.ts`, `pending-action.service.ts`, `library.spec.ts`.

**Fichiers modifiés :**
- backend : `src/access.js`, `src/app.js`, `src/routes/public.js`, `src/migrations/index.js`, `src/migrations/001-track-style-visibility.js`, `test/api.test.js` ;
- `API_CONTRACT.md` ;
- frontend : `online-track.service.ts`, `track.model.ts`, `auth.guard.ts`, `icons.ts`, `icon.ts`, les pages de connexion et d'inscription, `track-tile`, `player-bar`, `tracks-page`, `app`, `routes.ts`.

**Aucun commit** (non demandé). Base de démonstration conservée et remise dans son état de départ après les tests.

**État :** terminé. Point d'étape avec l'utilisatrice avant les sections 6 et 7.

## Demande 19 — MOST VIBE, étape 3 : sections 6 et 7 (14/10/2026)

> « pas de commit. c'est moi qui doit le faire, continue avec les sections 6 et 7 »

**Interprétation :**
- **aucun commit** : c'est l'étudiante qui commit elle-même, et l'assistant ne le proposera plus ;
- continuer la mission avec la section 6 (amis) et la section 7 (messagerie).

**Plan :**
- **Section 6 — Amis :**
  - recherche de profils ;
  - invitations : envoyer, accepter, refuser, annuler ;
  - retrait d'un ami, blocage et déblocage ;
  - fil d'activité des amis, limité à ce que l'utilisateur a le droit de voir ;
  - « Amis choisis » limité aux amis.
- **Section 7 — Messagerie :**
  - conversations entre amis, avec le nombre de messages non lus et des notifications ;
  - outil « Envoyer une de mes pistes » : recherche, pochette, titre, durée, pré-écoute ;
  - la piste part sous forme de carte musicale ;
  - une piste privée envoyée donne accès à ce seul destinataire ;
  - si l'accès est retiré, la carte affiche « Partage interrompu ».

### Questions posées pendant le travail

- **« tu as d'abord fait le commit? »**
  - Non. L'assistant n'a fait aucun commit.
  - Le dernier commit de la branche `most-vibe` (`e17973b`, « 14/10/2026 », 14 h 34) est celui de l'étudiante. Il contient 38 fichiers d'avant MOST VIBE.
  - Tout le travail MOST VIBE (étapes 1 à 3) reste à commiter par elle.
- **« pourquoi interrupted »**
  - Le message « interrupted » apparaît quand l'interface reçoit un ordre d'arrêt (touche Échap ou bouton stop). Ce n'était pas une erreur.
  - Rien n'était cassé : la dernière commande s'était terminée, et le travail a repris au même endroit.

### Incident pendant le travail : connexion MongoDB Atlas refusée

- Les tests d'intégration ont d'abord échoué sans exception : « Could not connect to any servers… IP whitelist ».
- Internet fonctionnait, mais l'adresse IP publique de l'ordinateur avait changé (185.182.193.109), et Atlas n'accepte que les adresses autorisées.
- L'assistant a expliqué comment ajouter l'adresse dans **Network Access** et a continué ce qui ne demandait pas la base (documentation, frontend).
- L'adresse habituelle est revenue (82.225.132.237), la connexion a refonctionné, et tous les tests ont été relancés.

### Ce qui a été fait

#### Backend

| Élément | Détail |
|---|---|
| Nouveaux modèles | `Friendship` (invitation ou amitié, une par paire), `Block`, `Conversation` (une par paire d'amis, avec la date de lecture de chacun), `Message` (texte et/ou piste), `Notification` |
| Module `social.js` | Fonctions communes : sont-ils amis ? l'un a-t-il bloqué l'autre ? liste des amis ; création de notifications. Une seule notification de messages par conversation (avec un compteur) |
| `routes/social.js` | Recherche de profils (avec la relation de chacun), profil public, invitations (envoyer, accepter, refuser, annuler ; deux invitations croisées = amis), retrait d'un ami, blocage et déblocage, fil d'activité, notifications, compteurs du menu |
| `routes/messages.js` | Conversations, messages, cartes musicales, lecture (non lus) |
| « Amis choisis » | Seulement parmi ses amis (`403` sinon) ; notification « a partagé une piste avec vous » |
| Retrait d'un ami | Retire les accès « Amis choisis » dans les deux sens |
| Blocage | Supprime l'amitié et les invitations, retire **tous** les accès donnés à la personne bloquée, la cache de la recherche et du profil (`404`), interdit les messages (l'historique reste lisible) |
| Carte musicale | On ne peut envoyer que **ses** pistes. Une piste non publique devient accessible à **ce seul destinataire** (elle reste privée). Les droits sont revérifiés à chaque lecture : si l'accès est retiré, le serveur ne renvoie plus que le titre et l'état « interrupted » |
| Durée des pistes | Nouveau champ facultatif `durationSeconds`, mesuré par le navigateur à l'envoi, ou une seule fois depuis l'outil d'envoi de piste |
| Migration 003 | Crée les 5 collections et leurs index. Annulation sans perte (une collection non vide est renommée) |
| Base réelle | Sauvegarde `backend/backups/2026-10-14T20-25-15-296Z` (407 documents), **puis** migration 003 appliquée. Elle est aussi appliquée sur la base de démonstration |
| Documentation | `API_CONTRACT.md` : section « MOST VIBE — étape 3 » |

#### Frontend

| Élément | Détail |
|---|---|
| Page **Amis** (`/friends`) | Onglets : Fil d'activité, Mes amis (Écrire, Retirer, Bloquer, avec confirmation), Invitations (reçues : accepter ou refuser ; envoyées : annuler), Trouver des amis (recherche par nom), Bloqués (débloquer) |
| **Profil public** (`/u/:id`) | Nom, nombre d'amis, boutons selon la relation (Inviter, Accepter, Écrire, Bloquer), pistes visibles par le lecteur. Le nom de l'auteur sur chaque carte de piste mène à son profil |
| **Messages** (`/messages`, `/messages/:id`) | Liste des conversations avec les non-lus, fil des messages, Entrée pour envoyer, « Vu », messages plus anciens, mise à jour automatique toutes les 8 s. Sur mobile, une seule colonne avec un bouton retour |
| **Envoyer une de mes pistes** | Recherche dans mes pistes ; pochette, titre, style, **durée** et pré-écoute (lecteur local qui n'interrompt pas le lecteur principal) ; rappel « seul ce destinataire y aura accès » |
| Carte musicale | Lecture dans le lecteur principal ; « Partage interrompu » si l'accès a été retiré ; « Accès retiré à … » côté expéditeur ; « Piste supprimée » |
| Notifications | Cloche avec pastille (menu latéral et en-tête mobile) ; panneau des notifications ; un clic mène à la bonne page |
| Pastilles du menu | Invitations reçues sur « Amis », messages non lus sur « Messages », relues toutes les 20 s quand l'onglet est visible |
| Barre mobile | Accueil, Explorer, Biblio, **Messages**, Plus (Mixage est dans « Plus »). « Plus » a une pastille s'il contient des nouveautés |
| Fenêtre de partage | « Amis choisis » propose la liste de **mes amis**, avec un filtre par nom, au lieu de chercher dans tous les comptes |

### Tests

| Tests | Résultat |
|---|---|
| Backend `npm test` (dont 6 nouveaux scénarios A, B, C sur la base séparée `most-vibe-test-social`) | **24/24** |
| Frontend `npm test` (dont 4 nouveaux) | **42/42** |
| Build de production | OK |
| Test navigateur (Chrome sans fenêtre et **muet**, base de démonstration) | **51/51** |

Le test navigateur couvre :
- invitation, pastilles et cloche, acceptation ;
- fil d'activité (sans la piste privée de Bob) et profils ;
- message texte, outil d'envoi (durées, recherche, pré-écoute), carte musicale ;
- accès pour Bob seul (Bob 200, Chloé 403), non-lus, lecture depuis la carte ;
- retrait de l'accès, puis « Partage interrompu » côté Bob et « Accès retiré » côté Alice ;
- blocage puis déblocage ;
- mobile 400 px et absence d'erreur JavaScript.

Captures : `captures/most_vibe_etape3_*.png` (12 images). La base de démonstration est remise à zéro après les tests.

### Défauts trouvés pendant les tests, et corrections

| Ce qui n'allait pas | Ce qui a été changé |
|---|---|
| **Page blanche sur `/u/…` et `/messages/…`** (défaut du projet de départ). `src/index.html` n'avait pas de balise `<base href="/">`. Sur une adresse à deux niveaux, le navigateur cherchait `/u/main.js` au lieu de `/main.js`, et l'application ne démarrait pas. Les adresses à un niveau (`/library`) n'étaient pas touchées, d'où un défaut invisible jusqu'ici | Ajout de `<base href="/" />` dans `index.html`. Le titre « Guitar Practice Cloud », resté de l'ancien projet, devient « MOST VIBE » |
| **Panneau de la cloche coupé** sur ordinateur, par le bord du menu latéral, avec une barre de défilement horizontale | Depuis le menu, le panneau s'ouvre en position fixe à côté du menu (test : entièrement visible) |
| **Carte musicale qui débordait de sa bulle sur mobile** (« Accès retiré à Bob Bea… », « Vu » coupé) | Largeur minimale réduite, largeur limitée à la bulle, texte qui passe à la ligne |
| **Flèche « retour » visible sur ordinateur** dans Messages : une règle CSS écrite plus bas (`.icon-btn`) annulait `display: none` | La règle qui la cache est placée après, avec un sélecteur plus précis |
| **Titre « Amis » poussé à droite** de la page, loin de « Communauté » | Les deux textes sont regroupés |
| **« Messages » absent de la barre mobile** : seuls les 4 premiers éléments y figuraient, et la pastille des non-lus était invisible sur téléphone | Barre : Accueil, Explorer, Biblio, Messages, Plus (pastille sur « Plus ») |
| **Écriture des dates de lecture (repéré à la relecture du code)** : la première version réécrivait toute la liste des dates de lecture d'une conversation. Si les deux personnes agissaient au même moment, l'une pouvait effacer la date de l'autre | Chacun ne met à jour que sa propre date (mise à jour ciblée dans MongoDB) |
| **Dossier vide `backend/src/data/uploads` créé par erreur** : une vérification lancée depuis le mauvais dossier l'avait créé | Supprimé (il était vide) |
| Tests de l'étape 2 : « Amis choisis » exige maintenant une amitié, et l'annulation des migrations passe aussi par la 003 | Dans le test, A devient amie avec B et C ; les amitiés renommées par l'annulation de la 003 sont remises en place |
| Test du blocage : il attendait 1 accès retiré, le serveur en retire 2 (celui que B avait donné à A **et** celui qu'A avait donné à B). C'est la règle prévue ; l'erreur était dans le test | Test corrigé ; il vérifie aussi ce second accès |

### Choix à connaître

- **Les messages ne sont pas « en direct » :** la conversation ouverte se met à jour toutes les 8 s, et les pastilles toutes les 20 s, seulement quand l'onglet est visible. Un vrai direct (WebSocket) serait possible plus tard si besoin.
- **Une invitation refusée est simplement supprimée :** l'expéditeur n'est pas prévenu, et peut réinviter.
- **Débloquer ne rétablit pas l'amitié :** il faut une nouvelle invitation.
- **Le script de test de l'étape 2** (`e2e-mv2`, dossier temporaire) partageait avec des personnes non amies. Ce n'est plus permis, volontairement (section 6).

**Fichiers créés :**
- backend : `src/models/Friendship.js`, `Block.js`, `Conversation.js`, `Message.js`, `Notification.js` ; `src/social.js` ; `src/routes/social.js`, `messages.js` ; `src/migrations/003-friends-messages.js` ; `test/most-vibe-social.test.js` ;
- frontend : `components/friends-page/*`, `user-profile-page`, `messages-page/*`, `track-picker`, `notification-bell` ; `shared/services/social.service.ts`, `counters.service.ts`, `social.spec.ts` ; `shared/audio/duration.ts`.

**Fichiers modifiés :**
- backend : `src/app.js`, `src/models/Track.js`, `src/routes/library.js`, `src/routes/public.js`, `src/migrations/index.js`, `test/most-vibe-library.test.js` ;
- `API_CONTRACT.md` ;
- frontend : `src/index.html`, `routes.ts`, `app` (menu, pastilles, cloche), `share-dialog`, `track-tile`, `tracks-page`, `track.model.ts`, `track.service.ts`.

**Aucun commit :** c'est l'étudiante qui commit.

**État :** terminé. Point d'étape avec l'utilisatrice avant les sections 8, 9 et 10.

## Demande 20 — MOST VIBE, étape 4 : sections 8, 9 et 10 (14/10/2026)

> « oui » (réponse au point d'étape : « Je continue avec les sections 8 à 10 ? »)

**Interprétation :** continuer la mission avec trois sections :
- section 8 : mixages et remixes ;
- section 9 : paramètres ;
- section 10 : administration.

Toujours **aucun commit**.

**Plan :**
- **Section 8 — Mixages et remixes :**
  - brouillons de mixage enregistrés en base, à reprendre plus tard ;
  - publication avec la visibilité choisie ;
  - remix soumis à l'accord de l'auteur (demande, puis acceptation ou refus) ;
  - crédits « Remix par… » et « À partir de la création de… », que le remixeur ne peut pas modifier (contrôlé par le serveur).
- **Section 9 — Paramètres :**
  - profil, confidentialité, notifications, utilisateurs bloqués ;
  - suppression du compte avec confirmation et explication des conséquences.
- **Section 10 — Administration :**
  - rôle administrateur sécurisé : utilisateurs, signalements, contenus publics ;
  - aucun accès aux fichiers privés ni aux conversations.

*Interruption : pendant ce travail, la demande 21 (mise en page de Backing tracks) a été traitée en priorité ; voir plus bas.*

### Ce qui a été fait

#### Section 8 — Mixages et remixes

| Élément | Détail |
|---|---|
| Brouillons | La barre « Projet » du studio enregistre en base l'état du studio : pistes des platines, position, tempo, égaliseur, filtre, effets, volumes, crossfader et volume général. « Reprendre » (`/mix?project=…`) recharge les pistes **sans les démarrer** et remet chaque réglage |
| Publication | Après « Enregistrer le mix » (fonction existante, conservée avec son téléchargement), « Publier… » envoie l'enregistrement comme piste « mixage » avec la visibilité choisie (Privé, Amis choisis puis choix des amis, Public), le style et une pochette facultative |
| Remix | Bouton « ⋯ » puis « Remixer » sur la piste d'un autre membre : état de l'autorisation, demande avec message, ouverture dans le studio. L'auteur accepte ou refuse dans « Ma bibliothèque › Projets de mixage ». Notifications à chaque étape |
| Contrôle serveur | Publication **refusée (403)** tant qu'une piste d'un autre membre n'a pas son autorisation acceptée ; refusée (400) si un morceau en ligne est sous licence « ND » (œuvre dérivée interdite) |
| Crédits | « Remix par… » et « À partir de la création de… » calculés et **figés par le serveur**. Aucune route ne permet de les modifier (vérifié : un `PATCH` qui envoie d'autres crédits ne change rien). Ils sont affichés sur la carte du mixage |
| Limite assumée | Le serveur ne peut pas analyser l'audio. Il crédite les pistes que le studio déclare avoir utilisées : celles chargées au début de l'enregistrement et pendant celui-ci, chacune vérifiée |

#### Section 9 — Paramètres (`/settings`)

- Profil (nom affiché) et changement de mot de passe (mot de passe actuel demandé).
- Confidentialité :
  - recevoir ou non des invitations ;
  - apparaître ou non dans la recherche (les amis vous trouvent toujours) ;
  - visibilité proposée pour les nouvelles pistes et les mixages.
- Notifications : 5 interrupteurs. Les avis de l'administration restent toujours envoyés.
- Comptes bloqués, avec « Débloquer ».
- **Suppression du compte :**
  - les 6 conséquences sont expliquées ;
  - le mot de passe est demandé, puis il faut taper SUPPRIMER ;
  - tout est effacé, fichiers compris ;
  - le jeton de connexion est refusé immédiatement ;
  - dans les crédits des mixages des autres, le nom devient « Compte supprimé ».

#### Section 10 — Administration (`/admin`)

| Élément | Détail |
|---|---|
| Rôle admin | Il s'attribue **seulement en ligne de commande** sur le serveur (`npm run role -- email admin`). Aucune route de l'API ne le permet. Le rôle est relu en base à chaque requête |
| Signalements | Tout membre peut signaler une piste qu'il peut écouter, ou un profil (motif et précisions). L'admin classe sans suite, dépublie, supprime ou suspend l'auteur, avec une note. L'auteur reçoit un avis |
| Utilisateurs | Recherche, compteurs, suspension avec raison (jetons refusés tout de suite, connexion refusée avec la raison), levée de la suspension |
| Contenus | Seulement les pistes **publiques** |
| Ce que l'admin ne peut pas faire | Écouter une piste privée (403, comme tout le monde), dépublier ou supprimer une piste non publique (403), voir les conversations (aucune route) |
| Menu | « Administration » n'apparaît que pour un admin. Un membre qui ouvre `/admin` voit « réservé à l'administration » |

#### Base de données

- La vraie base est sauvegardée dans `backend/backups/2026-10-14T21-12-37-517Z` (409 documents), **puis** la migration **004** est appliquée.
- La migration 004 crée les collections `mixprojects`, `remixrequests` et `reports`. Elle ajoute aux comptes les paramètres par défaut et les champs de suspension, seulement là où ils manquent.
- Son annulation renomme les collections et copie les paramètres des comptes avant de les retirer : rien n'est perdu.
- La migration 004 est appliquée aussi sur la base de démonstration.
- `API_CONTRACT.md` : section « MOST VIBE — étape 4 ».

### Tests

| Tests | Résultat |
|---|---|
| Backend (dont 8 nouveaux scénarios sur la base séparée `most-vibe-test-step4` : brouillon, remix refusé puis accepté, crédits figés, licence ND, paramètres, signalements, administration, suppression du compte) | **32/32** |
| Frontend (dont 4 nouveaux) | **46/46** |
| Navigateur, étape 4 (Chrome sans fenêtre et **muet**, base de démonstration) | **49/49** |
| Navigateur, étape 3 (non-régression) | **51/51** |

Le test navigateur de l'étape 4 couvre :
- brouillon et reprise ;
- enregistrement, publication bloquée, demande d'autorisation, accord, publication ;
- crédits sur la carte ;
- « Remixer » et « Signaler » ;
- réponse aux demandes ;
- paramètres et suppression d'un compte ;
- refus de l'admin aux membres ;
- dépublication sur signalement, puis l'admin ne peut plus écouter la piste ;
- suspension ;
- mobile 400 px et absence d'erreur JavaScript.

Captures : `captures/most_vibe_etape4_*.png` (12 images).

### Défauts trouvés, et corrections

| Ce qui n'allait pas | Ce qui a été changé |
|---|---|
| **Textes d'aide avec des espaces en trop autour d'un mot en gras** (« Chaque piste est  Privée  par défaut », depuis l'étape 2 ; aussi dans l'administration). Ces bandeaux étaient des boîtes « flex » : le mot en gras devenait un bloc séparé, avec un écart de chaque côté | Les bandeaux d'aide s'affichent maintenant en texte normal, l'icône étant placée en ligne |
| **Test d'annulation des migrations (étape 2)** : il annulait 2 migrations, ce qui ne remontait plus jusqu'à la 002 une fois la 004 ajoutée | Il annule maintenant 3 migrations, et remet en place les collections renommées par la 003 et la 004 |
| **Mes propres scripts de test** (pas l'application) : une notification « ancienne » prise pour la plus récente ; quatre clics écrits avec un sélecteur brut au lieu de `document.querySelector(...)` ; un motif de texte trop strict | Corrigés ; chaque échec a été analysé avant correction pour vérifier que l'application n'était pas en cause |

### Choix à connaître

- **Un enregistrement de mix n'existe que dans l'onglet ouvert.** On le publie avant de fermer la page ; seul le **brouillon** (l'état du studio) est gardé en base.
- **S'entraîner avec la piste publique d'un autre membre est permis** ; seule la **publication** exige son accord.
- **L'écran d'attente des sections à venir (`upcoming-page`) est supprimé** : toutes les sections du menu existent maintenant.

**Fichiers créés :**
- backend : `src/models/MixProject.js`, `RemixRequest.js`, `Report.js` ; `src/routes/mixes.js`, `settings.js`, `admin.js` ; `src/sessions.js`, `src/track-cleanup.js` ; `src/migrations/004-mixes-settings-admin.js` ; `scripts/set-role.mjs` ; `test/most-vibe-step4.test.js` ;
- frontend : `components/mix-project-bar`, `mix-publish-dialog`, `remix-dialog`, `report-dialog`, `settings-page/*`, `admin-page/*` ; `shared/services/mix.service.ts`, `settings.service.ts`, `admin.service.ts`, `step4.spec.ts`.

**Fichiers modifiés :**
- backend : `src/app.js`, `server.js`, `constants.js`, `social.js`, `models/User.js`, `Track.js`, `Notification.js`, `routes/public.js`, `routes/social.js`, `migrations/index.js`, `package.json` (script `role`), `test/most-vibe-library.test.js` ;
- `API_CONTRACT.md` ;
- frontend : `dj-engine.service.ts`, `dj.model.ts`, `track.model.ts`, `user.model.ts`, `auth.service.ts`, `social.service.ts`, `icons.ts`, `mix-page`, `library-page`, `track-tile`, `reaction-buttons`, `notification-bell`, `user-profile-page`, `friends-page.css`, `tracks-page.ts`, `app` (menu), `routes.ts`.

**Fichier supprimé :** `components/upcoming-page/upcoming-page.ts`, qui ne servait plus.

**Aucun commit :** c'est l'étudiante qui commit.

**État :** terminé. Point d'étape avec l'utilisatrice avant les sections 11 à 13 (finitions, tests A/B/C, livrables).

## Demande 21 — Backing tracks : la liste des pistes déborde sur le bloc d'import (14/10/2026)

> « l'onglet des piste depasse l'onglet qui permet d'importer les musiques essaie d'ajuster ça »

**Contexte :** demande reçue pendant le travail sur l'étape 4 (demande 20). Elle est traitée tout de suite, puis l'étape 4 reprend.

### Diagnostic

- Mesures dans le navigateur (compte de démonstration, 405 pistes) à 1180 px et 1000 px : la carte « Mes pistes » recouvrait la colonne « Importer ».
- La cause n'était pas la liste. C'était la **colonne d'import, trop étroite** :
  - la page découpait la largeur en `1fr / 2fr` ; depuis l'ajout du menu latéral MOST VIBE (15,5 rem), il ne restait que 220 à 280 px pour l'import ;
  - les champs « Choisir un fichier » et les deux boutons « Choisir un dossier / Choisir des fichiers » ont une largeur naturelle fixe, qui ne rétrécit pas ;
  - ils dépassaient donc de leur colonne et passaient sous la carte « Mes pistes ».

### Ce qui n'allait pas → ce qui a été changé

| Ce qui n'allait pas | Ce qui a été changé |
|---|---|
| Colonne d'import réduite à un tiers de la largeur, devenue trop étroite avec le menu latéral | Colonne d'import à largeur garantie (17 à 21 rem) ; la liste prend le reste |
| Sur un écran moyen, deux colonnes trop serrées | Sous 1100 px, l'import passe au-dessus et la liste en dessous |
| Champs et sélecteurs de fichiers à largeur fixe, qui dépassaient | Ils suivent la largeur de leur carte (`width: 100%`, `min-width: 0`) |
| Les deux boutons de l'import multiple restaient côte à côte même sans place | Ils passent l'un sous l'autre quand la place manque |

### Vérification

- Mesure automatique à 1440, 1280, 1180, 1000, 760 et 400 px :
  - aucun élément de la colonne d'import ne dépasse ;
  - aucun chevauchement entre les deux cartes ;
  - pas de défilement horizontal.
- Tests frontend : 42/42.
- Captures : `captures/backing_tracks_mise_en_page_corrigee_1180.png` et `_1000.png`.

**Fichiers modifiés :** `components/tracks-page/tracks-page.css`, `components/bulk-import/bulk-import.css`.

**État :** terminé. La demande 20 (étape 4) reprend.

## Demande 22 — MOST VIBE, étape 5 : sections 11, 12 et 13 (15 et 16/10/2026)

> « oui » (réponse au point d'étape : « Je continue avec les sections 11 à 13 ? »)

**Interprétation :** dernière étape de la mission. Toujours **aucun commit**.

**Plan :**
- **Section 11 — Finitions :**
  - vérifier page par page les messages d'erreur clairs, les indicateurs de chargement et les états vides utiles ;
  - corriger ce qui manque ;
  - session expirée : reconnexion guidée ;
  - messages de connexion précis (amélioration proposée à la demande 16).
- **Section 12 — Tests :**
  - comptes A, B et C (A et B amis, C non) ;
  - liste de contrôle couvrant chaque point de la mission ;
  - tests navigateur rangés dans le projet pour pouvoir être relancés.
- **Section 13 — Livrables :**
  - résumé des changements par fonctionnalité ;
  - tests et résultats (échecs compris) ;
  - services à configurer ;
  - étapes de déploiement (sans affirmer que le site est en ligne sans l'avoir vérifié).

### Section 11 — Finitions

**Méthode :** un audit automatique de toutes les pages, dans deux situations :
1. avec un **compte neuf**, sans contenu, pour vérifier les états vides ;
2. avec une **API coupée**, pour vérifier les erreurs.

La plupart des pages étaient déjà correctes. L'audit a trouvé les défauts suivants, tous corrigés :

| Ce qui n'allait pas | Ce qui a été changé |
|---|---|
| Paramètres, API coupée : le profil restait sur « Chargement… » sans fin, et « Comptes bloqués » affichait à tort « Vous n'avez bloqué personne » | Vrais messages d'erreur, avec « Réessayer » |
| Administration, API coupée : « Chargement… » affiché sous le message d'erreur | Le chargement n'est plus affiché en cas d'erreur |
| Ma bibliothèque, API coupée : compteurs « 0 » sur les onglets alors que rien n'avait pu être lu | Les compteurs n'apparaissent qu'une fois les données réellement chargées |
| Backing tracks : erreur technique « Le chargement des pistes a échoué (HTTP 502) » ; état vide sec « Aucune piste. » | « Le serveur ne répond pas… » ; état vide qui explique comment importer |
| Audio et studio : erreurs sans explication ; « Aucun morceau dans cette catégorie » même sans aucun morceau | Message commun « Le serveur ne répond pas… » ; état vide qui renvoie vers Backing tracks |
| Session expirée (au bout de 2 h) : chaque page affichait une erreur, sans explication | Déconnexion propre, retour à la connexion avec « Votre session a expiré », puis retour à la page d'origine. Même chose pour un compte suspendu |
| **Défaut trouvé par le test navigateur :** après une session expirée, on revenait à l'accueil au lieu de la page demandée. Au démarrage, l'erreur 401 arrive pendant la navigation initiale, quand l'adresse vaut encore « / » | On garde l'adresse de la navigation en cours (ou de la barre d'adresse) |
| Messages de connexion trop vagues (amélioration proposée à la demande 16) | Messages distincts : serveur injoignable, identifiants incorrects, compte suspendu (avec la raison), email déjà utilisé |

### Section 12 — Tests (comptes A, B et C)

- **Liste de contrôle :** [`TESTS_MOST_VIBE.md`](TESTS_MOST_VIBE.md). Chaque point des sections 1 à 11 y est relié aux tests qui le vérifient.
- **Recette navigateur rangée dans le projet :** dossier [`tests-navigateur/`](tests-navigateur/README.md), avec une bibliothèque commune (Chrome **toujours muet**), cinq étapes et un lanceur `run-all.mjs`. Le lanceur :
  - démarre l'API de démonstration et les sites de test ;
  - remet la base de démonstration à zéro avant chaque étape ;
  - écrit `tests-navigateur/RESULTATS.md`.
- **Scripts de démonstration dans le backend :**
  - `npm run demo:seed` crée la base de démonstration ;
  - `npm run demo:reset` la remet à zéro ;
  - `npm run demo:start` lance l'API sur cette base (port 3001).
- **Correction de fond :** le script de démonstration applique maintenant les migrations avant d'ajouter les données. C'est la cause racine du défaut de l'étape 2 (styles effacés par la migration 001 rejouée).

**Résultats :**

| Tests | Résultat |
|---|---|
| Serveur (`npm test`) | **34/34** |
| Interface (`npm test`) | **50/50** |
| Recette navigateur (`node tests-navigateur/run-all.mjs`) | **197 réussis, 0 échoué(s)** |

| Étape | Contenu | Réussis | Échoués |
|---|---|---|---|
| E1 | Sections 1 à 3 : identité, navigation, pages publiques, recherche, liens directs | 30 | 0 |
| E2 | Sections 4 et 5 : bibliothèque, réactions, action après connexion, visibilité et partage | 38 | 0 |
| E3 | Sections 6 et 7 : amis, blocage, fil d’activité, messagerie, cartes musicales | 51 | 0 |
| E4 | Sections 8 à 10 : mixages et remixes, paramètres, administration | 49 | 0 |
| E5 | Section 11 : états vides, erreurs, session expirée, messages de connexion | 29 | 0 |

**Échecs rencontrés pendant la mise au point de la recette** (dans les outils de test, pas dans l'application) :
- **Le lanceur se bloquait lui-même :** il servait le site de test dans son propre processus et lançait les étapes avec `spawnSync`, qui gèle ce processus. Le site ne répondait donc plus. Correction : lancement asynchrone, puis sites de test dans des processus séparés (des blocages de Chrome pendant la lecture audio persistaient sinon).
- **Garde-fous ajoutés :** une limite de 30 s par commande envoyée à Chrome et une durée maximale de 10 minutes par étape. Un blocage devient un échec signalé, jamais une attente sans fin.
- **Rôle admin effacé :** la remise à zéro remettait Chloé au rôle « membre », alors que l'étape 4 a besoin d'une admin. Le lanceur lui donne ce rôle avec la commande officielle `set-role` (sur la base de démonstration).
- **Faux échec à l'étape 5 :** les messages que l'application journalise volontairement quand l'API est coupée étaient comptés comme des erreurs. Seules les vraies exceptions comptent maintenant.
- **Script `demo-start` sur le mauvais port :** il devait lancer l'API de démo sur le port 3001, mais gardait le port 3000 de `.env`, déjà pris par le serveur habituel. Le démarrage échouait. Corrigé : port de démo forcé (3001, ou `DEMO_PORT`).
- **Tests figés à cause d'une API de démo trop ancienne :** une API de démo lancée la veille, restée allumée pendant la mise en veille de l'ordinateur, faisait se bloquer les étapes 4 et 5. Avec une API redémarrée par le lanceur, la recette complète passe.
- **Nettoyage prudent après un blocage :** le nettoyage n'arrête que les processus portant la marque des tests (`mostvibe-tests`), jamais le Chrome de l'utilisatrice.

### Section 13 — Livrables

- [`LIVRABLES_MOST_VIBE.md`](LIVRABLES_MOST_VIBE.md) :
  - résumé des changements par fonctionnalité ;
  - tests et résultats, échecs compris ;
  - services à configurer ;
  - étapes de mise en ligne, vérifications après mise en ligne, retour en arrière.
- **Préparation de la mise en ligne (backend) :**
  - `FRONTEND_DIST` : le serveur peut servir le site compilé (une seule adresse pour le site et l'API). Vérifié sur cet ordinateur : une adresse profonde, l'API et le test navigateur de l'étape 1 (30/30) passent sur ce serveur unique ;
  - `CORS_ORIGIN` : limite les sites autorisés à appeler l'API ;
  - en production, le serveur refuse de démarrer sans un vrai `JWT_SECRET` (32 caractères minimum).
- `backend/.env.example`, `API_CONTRACT.md` (section « étape 5 ») et `README.md` (renvois vers les livrables) sont mis à jour.
- **Le site n'a pas été mis en ligne :** les étapes sont prêtes, mais aucune n'a été exécutée sur un hébergeur. Le document le dit clairement.

**Fichiers créés :**
- `LIVRABLES_MOST_VIBE.md`, `TESTS_MOST_VIBE.md` ;
- `tests-navigateur/` (`README.md`, `lib.mjs`, `serveur-test.mjs`, `run-all.mjs`, `etape1` à `etape5`, `.gitignore`, `RESULTATS.md`) ;
- `backend/scripts/demo-seed.mjs`, `demo-reset.mjs`, `demo-start.mjs` ;
- `frontend-starter/src/app/shared/interceptors/auth.interceptor.spec.ts`.

**Fichiers modifiés :**
- backend : `src/app.js`, `src/server.js`, `.env.example`, `package.json` (scripts `demo:*`), `test/api.test.js` (2 tests ajoutés) ;
- frontend : `auth.interceptor.ts`, `auth.service.ts`, les pages de connexion et d'inscription, `library.service.ts` (message d'erreur commun), `reactions.service.ts`, les pages Paramètres, Administration, Ma bibliothèque, Backing tracks et Audio, `dj-library` ;
- `API_CONTRACT.md`, `README.md`.

**Aucun commit :** c'est l'étudiante qui commit.

**État :** terminé. La mission MOST VIBE (sections 1 à 13) est terminée.

## Demande 23 — Question sur le problème rencontré pendant la recette (16/10/2026)

> « c'est quoi le probleme rencontré? »

**Contexte :** la question est arrivée pendant la mise au point de la recette navigateur de la demande 22. L'étudiante avait ouvert `RAPPORT_IA.md`.

**Réponse donnée :**
- **L'application n'était pas en cause.** Ses défauts de la section 11 avaient déjà été trouvés et corrigés (voir demande 22).
- **Les problèmes venaient de l'outil de test automatique :**

| Ce qui n'allait pas | Ce qui a été changé |
|---|---|
| Le lanceur de recette servait le site ET attendait les tests dans le même programme : le site cessait de répondre | Lancement asynchrone, puis sites de test dans des processus séparés |
| La remise à zéro de la démo enlevait le rôle admin nécessaire à l'étape 4 | Le lanceur donne ce rôle avec la commande officielle `set-role` avant l'étape 4 |
| Des messages d'erreur volontaires (API coupée exprès) étaient comptés comme des plantages | Seules les vraies exceptions comptent à l'étape 5 |
| Le script `demo-start` gardait le port 3000 de `.env` (déjà pris) au lieu du port 3001 | Port de démo forcé (3001, ou `DEMO_PORT`) |
| Une API de démo lancée la veille, restée allumée pendant la mise en veille, faisait se figer les étapes 4 et 5 | API redémarrée par le lanceur. Garde-fous : 30 s maximum par commande envoyée à Chrome, 10 minutes maximum par étape |

**Résultat après corrections :** recette complète **197 réussis, 0 échoué**. Tests du serveur : 34/34. Tests de l'interface : 50/50.

**Fichiers modifiés :** `backend/scripts/demo-start.mjs`, `tests-navigateur/lib.mjs`, `tests-navigateur/run-all.mjs`, `tests-navigateur/etape5-finitions.mjs`.

**État :** terminé.
