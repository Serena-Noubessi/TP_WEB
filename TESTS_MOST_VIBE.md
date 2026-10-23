# MOST VIBE — Liste de contrôle des tests (section 12)

Ce document relie chaque point de la mission aux tests qui le vérifient.

**Trois niveaux de tests :**

| Niveau | Commande | Base utilisée |
|---|---|---|
| **Serveur** (intégration, vraie API + MongoDB) | `cd backend && npm test` | bases de test séparées `most-vibe-test`, `most-vibe-test-library`, `most-vibe-test-social`, `most-vibe-test-step4`, effacées avant et après |
| **Interface** (tests unitaires Angular) | `cd frontend-starter && npm test` | aucune (appels HTTP simulés) |
| **Navigateur** (recette de bout en bout, Chrome sans fenêtre et **muet**) | `node tests-navigateur/run-all.mjs` | base de démonstration `most-vibe-demo`, remise à zéro avant chaque étape |

**Comptes de la recette :**

| Compte | Email | Situation |
|---|---|---|
| A | `alice@mostvibe.test` | crée, partage, remixe |
| B | `bob@mostvibe.test` | **ami de A** pendant les tests |
| C | `chloe@mostvibe.test` | **pas ami** : sert à vérifier les refus ; administratrice pendant l'étape 4 |

Le mot de passe des trois comptes est `MotDePasse123`.

**Légende des colonnes :**
- « Serveur » cite le fichier de `backend/test/` ;
- « Navigateur » cite le script de `tests-navigateur/` (E1 à E5 = `etape1` à `etape5`).

Le résultat de la dernière exécution est en bas de page et dans [`tests-navigateur/RESULTATS.md`](tests-navigateur/RESULTATS.md).

## Section 1 — Identité visuelle

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Nom MOST VIBE, logo MV, titre de l'onglet | — | E1 | ✔ |
| Couleurs #007FFF, #A99BEF, #F5FAFF, #FFFFFF, #18324F en variables de thème | — | E1 | ✔ |
| Plus aucune ancienne couleur (accueil, studio de mixage, Audio) | — | E1 | ✔ |

## Section 2 — Navigation

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Menu vertical : Accueil, Explorer, Ma bibliothèque, Studio de mixage, Amis, Messages, Paramètres | — | E1 | ✔ |
| Onglets existants conservés (Backing tracks, Audio, Mixage) | — | E1 | ✔ |
| Barre mobile (Accueil, Explorer, Biblio, Messages, Plus), sans débordement | — | E1, E3, E4 | ✔ |
| Lecteur persistant : la musique continue en changeant de page | — | E1 | ✔ |

## Section 3 — Pages publiques et recherche

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Accueil et Explorer sans compte | `most-vibe-public` | E1 | ✔ |
| 7 styles ; sections récents, sélection, mixages, albums | `most-vibe-public` | E1 | ✔ |
| Chaque piste : pochette, titre, style, auteur (jamais son email) | `most-vibe-public` | E1 | ✔ |
| Recherche par titre, auteur, style, album, tags ; filtres | `most-vibe-public` | E1 | ✔ |
| Aucune piste privée ou « Amis choisis » dans la recherche | `most-vibe-public`, `most-vibe-library` | E1, E2 | ✔ |
| Droits revérifiés sur les **liens directs** (audio, pochette) : 200 / 401 / 403, lecture partielle 206 | `api`, `most-vibe-public` | E1 | ✔ |

## Section 4 — Comptes et bibliothèque

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Ma bibliothèque : fichiers, albums, playlists, favoris, partagés avec moi, projets de mixage, profil | `most-vibe-library` | E2, E4 | ✔ |
| J'aime et favoris enregistrés en base, sans doublon | `most-vibe-library` | E2 | ✔ |
| Visiteur qui aime : invité à se connecter, **action faite automatiquement** après la connexion, retour à la page | — (interface : `library.spec`) | E2 | ✔ |
| Playlists : création, ajout, une piste privée d'autrui reste cachée | `most-vibe-library` | E2 | ✔ |
| Morceaux en ligne enregistrés en base (reprise unique de l'ancienne liste du navigateur) | `most-vibe-library` | E2 | ✔ |

## Section 5 — Visibilité

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Privé par défaut ; Amis choisis ; Public — à l'envoi et à la publication d'un mix | `most-vibe-library`, `most-vibe-step4` | E1, E2, E4 | ✔ |
| Changer la visibilité, voir qui a accès, retirer un accès | `most-vibe-library` | E2 | ✔ |
| Après retrait : refus immédiat (403) + message « un fichier déjà téléchargé ne peut pas être récupéré à distance » | `most-vibe-library` | E2 | ✔ |
| Repasser en Privé retire les accès « Amis choisis » | `most-vibe-library` | E2 | ✔ |

## Section 6 — Amis

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Recherche de profils (nom seulement, jamais l'email) | `most-vibe-social` | E3 | ✔ |
| Invitations : envoyer, accepter, refuser, annuler ; invitations croisées | `most-vibe-social` | E3 | ✔ |
| Retirer un ami (retire les accès « Amis choisis ») | `most-vibe-social` | — | ✔ |
| Blocage : plus d'amitié, d'accès, de messages, de recherche ni de profil ; déblocage | `most-vibe-social` | E3 | ✔ |
| Fil d'activité : seulement ce que A a le droit de voir ; C (non amie) a un fil vide | `most-vibe-social` | E3 | ✔ |
| « Amis choisis » réservé aux amis : A ne peut pas choisir C | `most-vibe-social` | E3 | ✔ |

## Section 7 — Messagerie

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Conversations entre amis seulement (C refusée) | `most-vibe-social` | E3 | ✔ |
| Messages non lus, pastilles, notifications (cloche) | `most-vibe-social` | E3 | ✔ |
| « Envoyer une de mes pistes » : recherche, pochette, titre, durée, pré-écoute | — | E3 | ✔ |
| Carte musicale ; piste privée accessible au **seul** destinataire (B 200, C 403) | `most-vibe-social` | E3 | ✔ |
| Accès retiré → « Partage interrompu » (et refus du fichier) | `most-vibe-social` | E3 | ✔ |

## Section 8 — Mixages et remixes

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Brouillon de mixage en base, repris (pistes, réglages, positions, sans lecture automatique) | `most-vibe-step4` | E4 | ✔ |
| Publication avec la visibilité choisie | `most-vibe-step4` | E4 | ✔ |
| Remix soumis à l'autorisation : demande, accord ou refus ; publication refusée sans accord (403) | `most-vibe-step4` | E4 | ✔ |
| Crédits « Remix par… » / « À partir de la création de… » figés par le serveur (un `PATCH` ne les change pas) | `most-vibe-step4` | E4 | ✔ |
| Morceau en ligne sous licence ND : publication refusée | `most-vibe-step4` | — | ✔ |

## Section 9 — Paramètres

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Profil, mot de passe | `most-vibe-step4` | E4 | ✔ |
| Confidentialité (invitations, recherche, visibilité par défaut) | `most-vibe-step4` | E4 | ✔ |
| Notifications par type | `most-vibe-step4` | E4 | ✔ |
| Comptes bloqués | `most-vibe-social` | E3, E4 | ✔ |
| Suppression du compte : conséquences expliquées, confirmation, tout est effacé (fichiers compris), jeton refusé | `most-vibe-step4` | E4 | ✔ |

## Section 10 — Administration

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| Rôle admin vérifié en base à chaque requête ; un membre est refusé | `most-vibe-step4` | E4 | ✔ |
| Signalements traités (classer, dépublier, supprimer, suspendre) ; l'auteur est prévenu | `most-vibe-step4` | E4 | ✔ |
| Suspension : jeton refusé immédiatement, connexion refusée avec la raison ; levée | `most-vibe-step4` | E4 | ✔ |
| **Aucun accès** aux fichiers privés (403) ni aux conversations (aucune route) | `most-vibe-step4` | E4 | ✔ |

## Section 11 — Finitions

| Point | Serveur | Navigateur | Résultat |
|---|---|---|---|
| États vides utiles (compte neuf) sur chaque page | — | E5 | ✔ |
| Erreurs claires quand l'API ne répond pas, sans « Chargement… » sans fin | — | E5 | ✔ |
| Session expirée : retour guidé à la connexion, puis à la page d'origine | — (interface : `auth.interceptor.spec`) | E5 | ✔ |
| Messages de connexion précis (serveur injoignable / identifiants / compte suspendu) | — (interface : `auth.interceptor.spec`) | E5 | ✔ |
| Sécurité de mise en ligne : CORS limité aux sites autorisés | `api` | — | ✔ |

## Fonctions d'origine conservées (non-régression)

| Point | Où | Résultat |
|---|---|---|
| Envoi, lecture, suppression des pistes ; pagination ; pochettes | `backend/test/api.test.js`, `tracks-page.spec` | ✔ |
| Studio de mixage (deux platines, enregistrement et téléchargement du mix) | E1, E4 | ✔ |
| Onglet Audio (lecteur, vitesse, volume) | `audio-player.service.spec`, E5 | ✔ |
| Morceaux en ligne (lien direct, Jamendo) | `remote-audio.spec`, E2 | ✔ |

## Dernière exécution

Exécution du 16/10/2026, sur l'ordinateur de développement :

| Niveau | Résultat |
|---|---|
| Serveur (`cd backend && npm test`) | **34 réussis, 0 échoué** |
| Interface (`cd frontend-starter && npm test`) | **50 réussis, 0 échoué** |
| Recette navigateur (`node tests-navigateur/run-all.mjs`) | **197 réussis, 0 échoué** : étape 1 = 30, étape 2 = 38, étape 3 = 51, étape 4 = 49, étape 5 = 29 |

Le détail de la recette est dans [`tests-navigateur/RESULTATS.md`](tests-navigateur/RESULTATS.md). Les échecs rencontrés avant d'arriver à ce résultat, et leurs corrections, sont dans [`LIVRABLES_MOST_VIBE.md`](LIVRABLES_MOST_VIBE.md#échecs-rencontrés-pendant-le-projet-et-suites-données) et dans [`RAPPORT_IA.md`](RAPPORT_IA.md).
