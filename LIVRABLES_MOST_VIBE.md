# MOST VIBE — Livrables de la mission (section 13)

MOST VIBE est un mini réseau social de partage audio (musiques, mixes, remixes), construit sur le projet « Guitar Practice Cloud ».

- **Pile technique :** Angular 22 pour le frontend ; Express 5, Mongoose 9 et MongoDB Atlas pour le backend.
- **Conservé :** les onglets Backing tracks, Audio et Mixage d'origine restent en place, avec tout leur contenu.

Ce document regroupe les quatre livrables demandés :
1. le résumé des changements par fonctionnalité ;
2. les tests effectués et leurs résultats, échecs compris ;
3. les services à configurer ;
4. les étapes de mise en ligne.

L'historique détaillé de chaque demande, avec ses dates, ce qui n'allait pas et ce qui a été corrigé, est dans [`RAPPORT_IA.md`](RAPPORT_IA.md). Chaque route de l'API est documentée dans [`API_CONTRACT.md`](API_CONTRACT.md).

> **État de la mise en ligne :** le site **n'a pas été mis en ligne**. Toutes les vérifications ont été faites sur un ordinateur local, avec la base MongoDB Atlas (vraie base, base de démonstration et bases de test séparées). Les étapes de mise en ligne ci-dessous sont prêtes, mais elles n'ont pas été exécutées sur un hébergeur.

---

## 1. Résumé des changements par fonctionnalité

### Sections 1 à 3 — Identité, navigation, pages publiques

| Fonctionnalité | Ce qui a été fait |
|---|---|
| Identité visuelle | Nom MOST VIBE, logo MV. Couleurs de la charte en variables de thème (`--mv-*`), appliquées partout, y compris au studio de mixage. Thème sombre conservé |
| Navigation | Menu vertical (Accueil, Explorer, Ma bibliothèque, Backing tracks, Audio, Mixage, Amis, Messages, Paramètres ; Administration pour un admin) et barre mobile. Lecteur audio persistant en bas de l'écran |
| Pages publiques | Accueil et Explorer **sans compte** : 7 styles (hip-hop, afro, électro, pop, jazz, rock, autres), ajouts récents, sélection, mixages, albums. Chaque piste affiche sa pochette, son titre, son style et son auteur |
| Recherche | Texte libre (titre, auteur, album, tags) et filtres. Seuls les contenus publics sont renvoyés |
| Droits | Règle d'accès vérifiée par le serveur **à chaque requête**, y compris sur les liens directs vers un fichier audio ou une pochette |

### Sections 4 et 5 — Comptes, bibliothèque, visibilité

| Fonctionnalité | Ce qui a été fait |
|---|---|
| Ma bibliothèque | Onglets fichiers, albums, playlists, favoris, partagés avec moi, projets de mixage, profil |
| Réactions | « J'aime » et favoris en base. Un visiteur est invité à se connecter, puis l'action est faite automatiquement et il revient sur sa page |
| Visibilité | Privé (par défaut), Amis choisis ou Public, à l'envoi et à tout moment. Liste des personnes qui ont accès, retrait d'un accès avec le message « un fichier déjà téléchargé ne peut pas être récupéré à distance » |
| Morceaux en ligne | Les références (lien direct, catalogue Jamendo) sont enregistrées en base au lieu du navigateur |

### Sections 6 et 7 — Amis et messagerie

| Fonctionnalité | Ce qui a été fait |
|---|---|
| Amis | Recherche de profils (nom seulement), invitations (envoyer, accepter, refuser, annuler), retrait, blocage, profil public. Fil d'activité limité à ce que l'on a le droit d'écouter |
| Messagerie | Conversations entre amis, messages non lus, notifications (cloche et pastilles) |
| Cartes musicales | « Envoyer une de mes pistes » (recherche, pochette, titre, durée, pré-écoute). Une piste privée envoyée devient accessible au **seul** destinataire. Si l'accès est retiré, la carte affiche « Partage interrompu » |

### Sections 8 à 10 — Mixages, paramètres, administration

| Fonctionnalité | Ce qui a été fait |
|---|---|
| Brouillons de mixage | L'état du studio (pistes, positions, tempo, égaliseur, effets, volumes) est enregistré en base. On le reprend tel quel |
| Publication | L'enregistrement du mix est publié avec la visibilité choisie |
| Remix | Utiliser la piste d'un autre membre demande son autorisation (demande, puis accord ou refus). Le serveur refuse la publication sans accord |
| Crédits | « Remix par… » et « À partir de la création de… » sont calculés et **figés par le serveur** ; impossible de les modifier |
| Paramètres | Profil, mot de passe, confidentialité, notifications, comptes bloqués, suppression du compte (conséquences expliquées, mot de passe et mot « SUPPRIMER » demandés) |
| Administration | Signalements, suspension de comptes, dépublication ou suppression de contenus **publics**. Aucun accès aux fichiers privés ni aux conversations. Le rôle admin s'attribue seulement en ligne de commande sur le serveur |

### Section 11 — Finitions

| Fonctionnalité | Ce qui a été fait |
|---|---|
| États et erreurs | Chaque page a un indicateur de chargement, une erreur claire (« Le serveur ne répond pas… ») et un état vide qui dit quoi faire. Vérifié page par page avec un compte neuf et avec une API coupée |
| Session | Après expiration de la session (2 h), retour guidé à la connexion, puis à la page d'origine |
| Connexion | Messages précis : serveur injoignable, identifiants incorrects, compte suspendu (avec la raison) |
| Mise en ligne | Secret JWT obligatoire en production ; CORS limitable aux sites autorisés ; le serveur peut servir le site compilé (une seule adresse) |

### Base de données

- Quatre migrations **réversibles et sans perte** (001 à 004). Une collection non vide est renommée, jamais effacée. Les paramètres retirés sont d'abord copiés.
- La vraie base a été **sauvegardée avant chaque migration**. Les sauvegardes sont dans `backend/backups/`, dossier non suivi par Git.
- Commandes :
  - `npm run backup` et `npm run restore` : sauvegarder et restaurer ;
  - `npm run migrate` (et `-- status`, `-- down`) : migrations ;
  - `npm run role` : rôle admin ;
  - `npm run demo:seed`, `demo:reset`, `demo:start` : base de démonstration.

---

## 2. Tests effectués et résultats

| Niveau | Commande | Résultat (16/10/2026) |
|---|---|---|
| Serveur : intégration avec la vraie API et MongoDB (bases de test séparées, effacées avant et après) | `cd backend && npm test` | **34 réussis, 0 échoué** |
| Interface : tests unitaires Angular | `cd frontend-starter && npm test` | **50 réussis, 0 échoué** |
| Recette navigateur : Chrome sans fenêtre et muet, comptes A, B et C (A et B amis, C non) | `node tests-navigateur/run-all.mjs` | **197 réussis, 0 échoué** (détail : [`tests-navigateur/RESULTATS.md`](tests-navigateur/RESULTATS.md)) |

La correspondance entre chaque point de la mission et ses tests est dans [`TESTS_MOST_VIBE.md`](TESTS_MOST_VIBE.md).

### Échecs rencontrés pendant le projet, et suites données

Les tests ont trouvé de vrais défauts, tous corrigés puis retestés. Les principaux :

| Défaut trouvé par les tests | Correction |
|---|---|
| La migration 001, rejouée sur la base de démonstration, avait remplacé le style de 9 pistes. La vraie base n'était pas touchée | La migration garde un style existant. Le script de démonstration applique maintenant les migrations avant d'ajouter les données |
| Un « j'aime » pouvait disparaître de l'écran juste après la connexion (lecture plus ancienne arrivée après l'action) | Une lecture lancée pendant une action est ignorée |
| Pages `/u/…` et `/messages/…` blanches : `index.html` sans `<base href="/">` (défaut d'origine du projet) | Balise ajoutée |
| Panneau de notifications coupé, carte musicale débordante sur mobile, flèche « retour » visible sur ordinateur | Mise en page corrigée |
| Backing tracks : la liste recouvrait la colonne d'import | Colonne d'import à largeur garantie, empilement sur écran moyen |
| Paramètres et administration bloqués sur « Chargement… » quand l'API ne répond pas ; compteurs « 0 » trompeurs | Vrais états d'erreur |
| Après une session expirée, retour à l'accueil au lieu de la page demandée | Page d'origine conservée |

Certains échecs venaient de **mes propres outils de test**, pas de l'application :
- sélecteurs mal écrits, valeur attendue erronée ;
- lanceur de recette qui se bloquait lui-même ;
- script de démonstration qui démarrait sur le mauvais port ;
- ancienne API de démo restée allumée depuis la veille, qui faisait se figer les tests.

Chacun a été analysé avant d'être corrigé, pour vérifier que l'application n'était pas en cause. Une étape de la recette ne peut plus rester bloquée : elle est arrêtée et comptée en échec au bout de 10 minutes.

**Incident d'environnement :** une fois, MongoDB Atlas a refusé la connexion parce que l'adresse IP de l'ordinateur avait changé. Les tests ont été relancés une fois l'accès revenu.

---

## 3. Services à configurer

| Service | Pourquoi | Réglage |
|---|---|---|
| **MongoDB Atlas** | Base de données | Un cluster et un utilisateur de base (voir [`ATLAS_SETUP.md`](ATLAS_SETUP.md)). Dans **Network Access**, autoriser l'adresse IP du serveur (en local : celle de l'ordinateur, qui peut changer) |
| **Variables du backend** (`backend/.env`, jamais dans Git) | Configuration et secrets | `MONGODB_URI` (obligatoire) ; `JWT_SECRET` (32 caractères aléatoires minimum, **obligatoire en production**) ; `PORT` ; en production : `NODE_ENV=production`, `CORS_ORIGIN` (adresse du site), `FRONTEND_DIST` (si le serveur sert aussi le site). Modèle commenté : [`backend/.env.example`](backend/.env.example) |
| **Stockage des fichiers** | Les fichiers audio et les pochettes sont sur le disque du serveur (`backend/data/uploads`), seules leurs métadonnées sont en base | En ligne, ce dossier doit être sur un **disque persistant**. Sinon, les fichiers disparaissent à chaque redéploiement |
| **Premier administrateur** | Section 10 | Sur le serveur : `cd backend && npm run role -- <email> admin` |
| **Jamendo** (facultatif) | Catalogue de musique libre (onglet Backing tracks) | Un `client_id` gratuit, à saisir dans l'interface ou dans `frontend-starter/public/catalogs.local.json` (non suivi par Git). Jamais dans le code |
| **Sauvegardes** | Aucune perte de données | `cd backend && npm run backup` avant toute migration ou mise à jour. Penser aussi à sauvegarder le dossier `data/uploads` |
| **HTTPS** | Jetons de connexion et mots de passe | Fourni par l'hébergeur (certificat automatique). Obligatoire en ligne |

---

## 4. Étapes de mise en ligne

> Ces étapes n'ont **pas** été exécutées : le site n'est pas en ligne. Après une vraie mise en ligne, faire les vérifications de la fin de cette section avant d'annoncer que le site fonctionne.

### Architecture conseillée : un seul service

Le backend sert l'API **et** le site Angular compilé, grâce à `FRONTEND_DIST`. Le site appelle `/api/...` à la même adresse : pas de proxy, et CORS reste simple.

Il faut un hébergeur Node.js avec **disque persistant** pour `backend/data/uploads`, par exemple un petit VPS, ou une plateforme Node avec volume persistant.

### Étapes

1. **Sauvegarder** la base actuelle : `cd backend && npm run backup`.
2. **Compiler le site :** `cd frontend-starter && npm ci && npx ng build`. Le résultat est dans `frontend-starter/dist/gpc/browser`.
3. **Installer le backend** sur le serveur : `cd backend && npm ci --omit=dev`.
4. **Configurer** les variables d'environnement sur l'hébergeur (voir section 3) :
   - `MONGODB_URI` ;
   - `JWT_SECRET` (nouveau, long et aléatoire) ;
   - `NODE_ENV=production` ;
   - `PORT` ;
   - `CORS_ORIGIN=https://<adresse du site>` ;
   - `FRONTEND_DIST=../frontend-starter/dist/gpc/browser`.
5. **Autoriser l'adresse IP du serveur** dans MongoDB Atlas (Network Access).
6. **Appliquer les migrations :**
   - `npm run migrate -- status` pour voir l'état ;
   - puis `npm run migrate`, après la sauvegarde de l'étape 1.
7. **Rattacher le disque persistant** au dossier `backend/data/uploads`, puis y copier les fichiers existants.
8. **Démarrer :** `npm start` (ou le service de l'hébergeur) ; activer HTTPS.
9. **Créer le premier administrateur :** `npm run role -- <email> admin`.

### Vérifications après la mise en ligne

1. `https://<site>/api/health` répond `{"status":"ok"}`.
2. L'accueil s'affiche sans compte. Une adresse profonde comme `https://<site>/explore?style=afro` s'affiche aussi (pas de page blanche).
3. Inscription et connexion fonctionnent.
4. Envoyer une piste, l'écouter, puis la supprimer.
5. Un lien direct vers une piste privée, ouvert sans compte, répond 401.
6. Après un redémarrage du service, les fichiers envoyés sont toujours là (disque persistant).
7. Facultatif : depuis un poste de travail, lancer la recette sur l'adresse en ligne, **avec une base de démonstration séparée** : `WEB_URL=https://<site> API_URL=https://<site>/api node tests-navigateur/etape1-public.mjs`.

### Revenir en arrière

- Migrations : `npm run migrate -- down`. Une collection non vide est renommée, jamais effacée.
- Données : `npm run restore -- backups/<date> --oui`.

---

## Démarrer en local (développement)

```bash
# Terminal 1 — API (port 3000), avec backend/.env rempli
cd backend && npm install && npm start
# Terminal 2 — site (port 4200, proxy /api vers 3000)
cd frontend-starter && npm install && npm start
```

Pour la démonstration avec les comptes A, B et C :
- `cd backend && npm run demo:seed` (une fois) ;
- puis `npm run demo:start`, qui lance l'API sur le port 3001 avec la base `most-vibe-demo`.

## Limites connues

- **Pas de temps réel :** les messages sont relus toutes les 8 s, les pastilles toutes les 20 s. Un vrai direct demanderait des WebSockets.
- **Crédits des remixes :** le serveur ne peut pas analyser l'audio. Il crédite les pistes que le studio déclare avoir utilisées pendant l'enregistrement.
- **Enregistrement d'un mix :** il n'existe que tant que la page du studio est ouverte. Seul le brouillon (l'état du studio) est gardé en base.
- **Fichiers sur le disque du serveur :** pour plusieurs serveurs ou un gros volume, un stockage objet (type S3) serait plus adapté.
