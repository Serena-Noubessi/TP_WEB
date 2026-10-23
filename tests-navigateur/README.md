# Recette navigateur MOST VIBE

Ces scripts pilotent un vrai navigateur (Chrome sans fenêtre et **muet**) et vérifient chaque point de la mission sur une base de **démonstration** séparée. La vraie base n'est jamais utilisée.

## Comptes de démonstration (base `most-vibe-demo`)

| Compte | Email | Rôle dans les tests |
|---|---|---|
| A | `alice@mostvibe.test` | crée, partage, remixe ; devient amie avec B pendant les tests |
| B | `bob@mostvibe.test` | ami de A ; reçoit les partages et les demandes de remix |
| C | `chloe@mostvibe.test` | **pas** ami : doit être refusé partout où il le faut ; administratrice pendant l'étape 4 |

Le mot de passe des trois comptes est `MotDePasse123`.

La base contient 9 pistes :
- 7 publiques ;
- 2 privées : « Démo secrète » d'Alice et « Brouillon de Bob ».

Des comptes temporaires (`temp-…@mostvibe.test`) sont créés puis supprimés par certains tests.

## Prérequis

1. `backend/.env` rempli : `MONGODB_URI` doit donner accès au cluster Atlas, avec l'adresse IP de l'ordinateur autorisée dans **Network Access**.
2. Le site compilé : dans `frontend-starter/`, lancer `npx ng build`.
3. Google Chrome installé. Si Chrome n'est pas au chemin habituel, le préciser dans la variable `CHROME_PATH`.
4. Node.js 22 ou plus récent.

## Lancer

Depuis la racine du projet :

```bash
cd backend && npm run demo:seed && cd ..   # une seule fois : crée la base de démonstration
node tests-navigateur/run-all.mjs          # toute la recette (environ 10 minutes)
node tests-navigateur/run-all.mjs 3 4      # seulement les étapes 3 et 4
```

`run-all.mjs` fait tout le reste :
- il démarre l'API de démonstration (port 3001) si elle ne tourne pas déjà ;
- il sert le site sur le port 4300, plus une copie sur le port 4301 branchée sur une API absente, pour tester les messages d'erreur ;
- il remet la base de démonstration à zéro avant chaque étape (`npm run demo:reset`) ;
- il écrit le bilan dans [`RESULTATS.md`](RESULTATS.md).

Les captures d'écran vont dans `tests-navigateur/captures/` (ignoré par Git).

## Contenu

| Fichier | Sections de la mission | Ce qui est vérifié |
|---|---|---|
| `etape1-public.mjs` | 1, 2, 3 | Charte de couleurs et logo, menus visiteur et membre, onglets conservés, accueil public, lecteur persistant, recherche et filtres, aucun contenu privé, droits sur les liens directs (200 / 401 / 403), mobile |
| `etape2-bibliotheque.mjs` | 4, 5 | « J'aime » d'un visiteur exécuté après la connexion, favoris, playlists, Ma bibliothèque, « Amis choisis », liste des accès, retrait avec message, privé qui retire les accès, envoi « Amis choisis », morceaux en ligne repris en base |
| `etape3-amis-messages.mjs` | 6, 7 | Invitation, pastilles et cloche, acceptation, fil d'activité filtré, profils, messages, outil « Envoyer une de mes pistes » (durée, recherche, pré-écoute), accès pour le seul destinataire, « Partage interrompu », blocage |
| `etape4-mix-admin.mjs` | 8, 9, 10 | Brouillon de mixage repris, publication refusée sans autorisation puis acceptée, crédits figés, « Remixer », « Signaler », paramètres, suppression d'un compte, administration (refus aux membres, dépublication, suspension) |
| `etape5-finitions.mjs` | 11 | États vides d'un compte neuf, erreurs claires quand l'API ne répond pas, session expirée, messages de connexion |
| `lib.mjs` | — | Outils communs : Chrome muet, clics, saisie, captures, vérifications |
| `serveur-test.mjs` | — | Sert le site compilé et relaie `/api` (502 si l'API est absente) |
| `run-all.mjs` | — | Enchaîne tout et écrit `RESULTATS.md` |

Les tests automatiques du serveur (`cd backend && npm test`) et de l'interface (`cd frontend-starter && npm test`) complètent cette recette. Voir [`../TESTS_MOST_VIBE.md`](../TESTS_MOST_VIBE.md).
