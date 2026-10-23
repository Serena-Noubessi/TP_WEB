# Contrat HTTP - TP1

Base : `/api`. Sauf inscription et connexion, envoyer `Authorization: Bearer <token>`.

Le contrat HTTP ne dépend pas du choix de persistance : le backend fourni utilise Mongoose et MongoDB. MongoDB conserve les utilisateurs et métadonnées ; les octets des fichiers audio et des couvertures restent sur le disque du serveur.

| Méthode | Route | Requête | Réponse principale |
|---|---|---|---|
| GET | `/health` | - | `{ "status": "ok" }` |
| POST | `/auth/register` | `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | JWT | `200 User` |
| PUT | `/users/me` | `{name}` + JWT | `200 User` |
| GET | `/tracks?page=1&limit=5&search=...` | JWT | `AggregatePage<Track>` |
| POST | `/tracks` | multipart : `audio`, `title`, `cover` facultatif | `201 Track` |
| GET | `/tracks/:id/audio` | JWT | flux audio |
| GET | `/tracks/:id/cover` | JWT | flux image (JPEG, PNG ou WebP) |
| DELETE | `/tracks/:id` | JWT | `204` (bonus) |

`GET /tracks` utilise le plugin Mongoose `mongoose-aggregate-paginate-v2`. Les paramètres `page` et `limit` sont des nombres entiers; `page` vaut au minimum 1, `limit` vaut de 1 à 20 (5 par défaut pour les clients qui omettent `limit`). Le frontend demande actuellement 5 pistes par page. Le paramètre `search` est facultatif : s’il est renseigné, le backend filtre les titres sans tenir compte de la casse, traite sa valeur comme du texte littéral et la limite à 100 caractères. La requête renvoie uniquement les pistes du propriétaire authentifié, triées par `createdAt` décroissant.

`AggregatePage<Track>` suit les noms de champs du plugin : `docs` (pistes de la page), `totalDocs`, `limit`, `page`, `totalPages`, `nextPage`, `prevPage`, `hasNextPage`, `hasPrevPage` et `pagingCounter`. Chaque élément de `docs` contient les données publiques de la piste avec `id` chaîne; `_id` et `storedName` ne sont pas exposés.

Formats audio acceptés : MP3, WAV, OGG et M4A, 25 Mo maximum. L’image de
couverture est facultative ; les formats JPEG, PNG et WebP sont acceptés,
jusqu’à 5 Mo. `Track.coverUrl` contient l’URL authentifiée de la couverture ou
`null` lorsqu’aucune image n’a été fournie. Les noms de stockage ne sont jamais
exposés dans les réponses.

Erreurs courantes : `400` validation, `401` authentification, `404` ressource, `409` email déjà utilisé.


---

# MOST VIBE — étape 1 (sections 1 à 3), 14/10/2026

## Nouveaux champs d'une piste (`Track`)

| Champ | Type | Valeurs | Défaut |
|---|---|---|---|
| `style` | chaîne | `hip-hop`, `afro`, `electro`, `pop`, `jazz`, `rock`, `dance` (ajouté après la mission), `autres` | `autres` |
| `visibility` | chaîne | `private` (propriétaire seulement), `friends` (personnes choisies, section 5), `public` (tout le monde, y compris sans compte, et présente dans la recherche) | `private` |
| `tags` | tableau de chaînes | 10 au maximum, 30 caractères chacun, en minuscules | `[]` |
| `album` | chaîne ou `null` | 80 caractères au maximum | `null` |
| `kind` | chaîne | `track` (piste) ou `mix` (mixage) | `track` |

Ces champs apparaissent dans toutes les réponses qui renvoient une piste. Les champs internes `legacyTitle` et `legacyCategory` (valeurs d'avant la migration 001) ne sont jamais renvoyés.

`User` reçoit `role` : `user` (défaut) ou `admin`. `GET /users/me` le renvoie.

## Routes modifiées

| Méthode | Route | Changement |
|---|---|---|
| GET | `/tracks?page&limit&search&style` | Nouveau paramètre facultatif `style` (filtre). `400` si le style est inconnu. Reste limitée aux pistes de l'utilisateur connecté (JWT obligatoire). |
| POST | `/tracks` | Champs multipart facultatifs : `style`, `visibility` (défaut `private`), `tags` (séparés par des virgules), `album`. `400` si une valeur est invalide (les fichiers reçus sont alors supprimés). |
| GET | `/tracks/:id/audio` | **Authentification facultative.** Accès accordé au propriétaire, ou à tous si la piste est publique. Les droits sont vérifiés **à chaque requête**, y compris sur un lien direct. Réponses : `200` (ou `206` avec l'en-tête `Range`), `401` si un visiteur demande une piste non publique, `403` si un utilisateur connecté n'y a pas accès, `404` si la piste est inconnue. |
| GET | `/tracks/:id/cover` | Même règle d'accès que l'audio (`200`, `401`, `403`, `404`). |

Pour les routes à authentification facultative, un jeton invalide ou expiré est ignoré : la requête est traitée comme celle d'un visiteur, et un avertissement est journalisé.

## Nouvelles routes

### PATCH `/tracks/:id`

- **Authentification :** JWT obligatoire. Seul le **propriétaire** peut modifier sa piste.
- **Corps JSON :** au moins un champ parmi `title` (1 à 120 caractères), `style`, `visibility`, `tags` (tableau ou chaîne séparée par des virgules), `album` (chaîne vide = aucun album).
- **Réponses :**
  - `200` : la piste mise à jour ;
  - `400` : valeur invalide ou aucun champ fourni ;
  - `401` : sans JWT ;
  - `404` : piste inconnue, ou pas propriétaire (pour ne pas révéler l'existence de la piste).

### GET `/public/home`

- **Authentification :** facultative. Ne renvoie que des pistes **publiques**.
- **Réponse `200` :**
  - `recent` : les 12 dernières pistes publiques (de type `track`) ;
  - `selection` : 8 pistes publiques tirées au hasard ;
  - `mixes` : les 8 derniers mixages publics ;
  - `albums` : jusqu'à 8 albums, chacun sous la forme `{ title, author, count, coverUrl }` ;
  - `styles` : nombre de pistes publiques par style.

### GET `/public/tracks`

- **Authentification :** facultative. Ne renvoie **que** des pistes publiques, même pour un utilisateur connecté ou pour le propriétaire.
- **Paramètres (tous facultatifs) :**
  - `q` : texte libre, cherché dans le titre, le nom de l'auteur, l'album et les tags ;
  - `style` ;
  - `author` : nom de l'auteur, sans tenir compte des majuscules ;
  - `album` ;
  - `tag` : correspondance exacte ;
  - `kind` : `track` ou `mix` ;
  - `sort` : `recent` (défaut) ou `title` ;
  - `page` (au minimum 1) et `limit` (1 à 24, 12 par défaut).
  
  Les textes sont limités à 100 caractères et traités littéralement.
- **Réponse `200` :** `AggregatePage` (mêmes champs de pagination que `GET /tracks`). Chaque élément contient `{ id, title, style, kind, album, tags, mimeType, visibility, createdAt, author: { id, name }, coverUrl }`. L'email de l'auteur n'est jamais exposé.
- **Erreurs :** `400` si le style ou le type est inconnu.

### GET `/public/tracks/:id`

- **Authentification :** facultative.
- **Réponses :**
  - `200` : la fiche (mêmes champs que ci-dessus) si la piste est publique, ou si elle appartient à l'utilisateur connecté ;
  - `401` : visiteur face à une piste non publique ;
  - `403` : utilisateur connecté sans accès ;
  - `404` : piste inconnue.

## Migrations et sauvegarde (backend)

- `npm run backup` : sauvegarde complète de la base dans `backend/backups/<date>/` (ignoré par Git).
- `npm run restore -- backups/<date> --oui` : restauration.
- `npm run migrate`, `npm run migrate -- status`, `npm run migrate -- down` : appliquer, lister ou annuler les migrations.
- Migration **001-track-style-visibility** : style tiré de l'ancien préfixe du titre, visibilité `private`, tags, album et type. Réversible.


# MOST VIBE — étape 2 (sections 4 et 5), 14/10/2026

Toutes les routes ci-dessous exigent un **JWT** (`401` sans jeton ou avec un jeton invalide). Un identifiant mal formé donne `404`.

## Règle d'accès à une piste (mise à jour)

Une piste est lisible par :
- son propriétaire ;
- tout le monde si `visibility = public` ;
- une personne qui a un **accès actif** (non retiré) : accès « Amis choisis » (`via: share`) ou piste envoyée dans un message (`via: message`, section 7, valable même pour une piste privée).

Cette règle s'applique à `GET /tracks/:id/audio`, `GET /tracks/:id/cover` et `GET /public/tracks/:id` (`401` visiteur, `403` connecté sans accès). Une piste `friends` n'apparaît jamais dans `/public/*`.

## Routes modifiées

| Méthode | Route | Changement |
|---|---|---|
| PATCH | `/tracks/:id` | Si `visibility` passe à `private`, les accès `share` actifs sont retirés. La réponse contient en plus `revokedAccesses` (nombre d'accès retirés). |
| DELETE | `/tracks/:id` | Supprime aussi les réactions et les accès liés à la piste, et la retire de toutes les playlists. |
| GET | `/public/home`, `/public/tracks`, `/public/tracks/:id` | Chaque piste contient en plus `likeCount` (nombre de « j'aime »). |

## Réactions

### POST / DELETE `/tracks/:id/like` et `/tracks/:id/favorite`

- **Corps :** aucun.
- **POST** ajoute la réaction (refaire la requête ne crée pas de doublon). La piste doit être lisible par l'utilisateur.
- **DELETE** retire la réaction (aucune erreur si elle n'existait pas).
- **Réponse `200` :** `{ trackId, type: "like" | "favorite", active, likeCount }`.
- **Erreurs :** `401` sans JWT ; `403` piste non accessible (POST) ; `404` piste inconnue.

### GET `/me/reactions`

- **Réponse `200` :** `{ likes: [trackId…], favorites: [trackId…] }`.

## Espace personnel

### GET `/me/favorites`

- **Réponse `200` :** `{ docs: [piste…] }`, du favori le plus récent au plus ancien (200 au maximum). Les pistes devenues inaccessibles ne sont pas renvoyées. Les champs sont ceux de `/public/tracks`.

### GET `/me/shared`

- **Réponse `200` :** `{ docs: [piste…] }` : pistes d'autres personnes auxquelles j'ai un accès actif. Chaque piste contient en plus `sharedVia` (`share` ou `message`) et `sharedAt`.

### GET `/me/albums`

- **Réponse `200` :** `{ albums: [{ title, count, publicCount, trackIds, coverUrl, updatedAt }] }` : mes pistes regroupées par nom d'album.

## Accès individuels (« Amis choisis »)

### GET `/tracks/:id/access`

- **Propriétaire seulement.**
- **Réponse `200` :** `{ trackId, visibility, grants: [{ user: { id, name }, via, grantedAt, revokedAt, active }] }`. Les accès retirés restent listés (`active: false`).
- **Erreurs :** `404` si la piste est inconnue ou n'appartient pas à l'utilisateur.

### POST `/tracks/:id/access`

- **Propriétaire seulement.**
- **Corps JSON :** `{ "userIds": ["…"] }` (1 à 50 identifiants).
- **Effet :** crée ou réactive les accès. Une piste `private` passe automatiquement en `friends`.
- **Réponses :**
  - `201` : même format que `GET /tracks/:id/access` ;
  - `400` : liste vide, trop longue, identifiant invalide, ou soi-même dans la liste ;
  - `404` : piste inconnue, pas propriétaire, ou utilisateur inconnu.

### DELETE `/tracks/:id/access/:userId`

- **Propriétaire seulement.**
- **Effet :** retire l'accès immédiatement. L'audio et la pochette répondent `403` dès la requête suivante. La trace est conservée (`revokedAt`).
- **Réponse `200` :** liste des accès + `notice` : « L'accès est retiré : cette personne ne peut plus écouter ni télécharger la piste. Un fichier qu'elle aurait déjà téléchargé ne peut pas être récupéré à distance. »
- **Erreurs :** `404` si la piste ou l'accès est inconnu, ou si l'accès est déjà retiré.

## Recherche de profils

### GET `/users/search?q=`

- `q` : au moins 2 caractères (60 au maximum), cherché dans le **nom** seulement.
- **Réponse `200` :** `{ users: [{ id, name }] }`, 10 au maximum, sans l'utilisateur lui-même. L'email n'est jamais renvoyé. *(Étape 3 : chaque résultat contient en plus `relation` et `requestId`, voir plus bas.)*
- **Erreurs :** `400` si `q` fait moins de 2 caractères.

## Playlists

Une playlist a la forme `{ id, ownerId, name, description, visibility: "private" | "public", trackCount, createdAt, updatedAt }`.

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/playlists` | — | `200 { playlists }` : mes playlists |
| POST | `/playlists` | `{ name (1-80), description? (≤300), visibility? (défaut private) }` | `201` playlist ; `400` invalide ou plus de 100 playlists |
| GET | `/playlists/:id` | — | `200` playlist + `tracks` (seulement les pistes que **le lecteur** a le droit d'écouter) + `hiddenCount` ; `404` inconnue, ou privée et pas à moi |
| PATCH | `/playlists/:id` | `name`, `description`, `visibility` | `200` ; `400` ; `404` pas à moi |
| DELETE | `/playlists/:id` | — | `204` ; `404` |
| POST | `/playlists/:id/tracks` | `{ trackId }` | `200` (sans doublon) ; `400` trackId invalide ; `403` piste non accessible ; `404` playlist pas à moi ou piste inconnue |
| DELETE | `/playlists/:id/tracks/:trackId` | — | `200` ; `404` |

## Morceaux en ligne

Les morceaux ajoutés depuis internet (lien direct, Jamendo) sont désormais enregistrés **en base**, au lieu du navigateur. Seule la référence est stockée ; le fichier n'est jamais copié sur le serveur. Chacun ne voit que les siens.

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/external-tracks?style=` | — | `200 { docs }` (500 au maximum) |
| POST | `/external-tracks` | un morceau : `{ title, artist?, audioUrl, sourceId, sourceLabel, pageUrl?, license?, licenseUrl?, imageUrl?, durationSeconds?, style?, originalName?, mimeType?, size? }` | `201` morceau ; `400` titre manquant, adresse non http(s), ou source manquante |
| POST | `/external-tracks` | plusieurs : `{ items: [...] }` (1 à 200) | `201 { docs, rejected: [{ index, message }] }` |
| DELETE | `/external-tracks/:id` | — | `204` ; `404` |

Un morceau dont l'adresse audio est déjà enregistrée pour cet utilisateur n'est pas dupliqué : le morceau existant est renvoyé.

Format d'un morceau renvoyé : `{ id, title, originalName, mimeType, size, createdAt, style, online: { audioUrl, artist, sourceId, sourceLabel, pageUrl, license, licenseUrl, imageUrl, durationSeconds, category } }`.

## Migration 002

- **002-library-access** : crée les collections `reactions`, `trackaccesses`, `playlists` et `externaltracks` avec leurs index. Aucune donnée existante n'est modifiée.
- **Annulation (`down`) :** les collections vides sont supprimées ; celles qui contiennent des données sont **renommées** `rollback002_<nom>_<date>`, pas effacées.


# MOST VIBE — étape 3 (sections 6 et 7), 14/10/2026

Toutes les routes ci-dessous exigent un **JWT** (`401` sans jeton ou avec un jeton invalide). Un identifiant mal formé donne `404` (ou `400` dans un corps JSON).

## Règles

- **Amis :** une invitation acceptée crée une amitié. Une invitation refusée ou annulée, ou une amitié retirée, est supprimée.
- **Blocage :** tant qu'il existe, aucun des deux comptes ne peut inviter l'autre, lui écrire, le trouver dans la recherche ou voir son profil.
- **« Amis choisis » :** on ne peut donner accès qu'à ses amis. Retirer un ami retire les accès « Amis choisis » dans les deux sens. Bloquer quelqu'un retire **tous** les accès qu'on lui avait donnés (partages et pistes envoyées par message).
- **Messagerie :** réservée aux amis. Envoyer une de ses pistes non publiques donne accès à ce **seul** destinataire (`via: message`). Les droits de chaque carte musicale sont revérifiés à chaque lecture.

## Routes modifiées

| Méthode | Route | Changement |
|---|---|---|
| GET | `/users/search?q=` | Déplacée dans `routes/social.js`. Chaque résultat contient en plus `relation` (`friend`, `outgoing`, `incoming`, `none`) et `requestId` (invitation en cours, sinon `null`). Les comptes bloqués, dans un sens ou dans l'autre, sont exclus. |
| POST | `/tracks/:id/access` | `403` si l'une des personnes n'est pas une amie (« « Amis choisis » : vous ne pouvez partager qu'avec vos amis »). Chaque nouvelle personne reçoit une notification `track_shared`. |
| POST / PATCH | `/tracks`, `/tracks/:id` | Nouveau champ facultatif `durationSeconds` (0 à 86400, mesuré par le navigateur). `400` si la valeur est invalide. Renvoyé par toutes les routes qui renvoient une piste (`null` tant qu'il n'est pas connu). |

## Profils

### GET `/users/:id/profile`

- **Réponse `200` :** `{ id, name, memberSince, relation: "self" | "friend" | "outgoing" | "incoming" | "none", requestId, friendCount, tracks }`. `tracks` contient au plus 24 pistes de cette personne, **seulement celles que le lecteur a le droit d'écouter**.
- **Erreurs :** `404` si le profil est inconnu ou si l'un des deux a bloqué l'autre.

## Amis et invitations

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/friends` | — | `200 { friends, incoming, outgoing }`, chaque élément `{ requestId, user: { id, name }, createdAt, acceptedAt }` |
| POST | `/friends/requests` | `{ userId }` | `201 { requestId, status: "pending" }` ; `200 { status: "accepted" }` si l'autre m'avait déjà invité ; `400` soi-même ou identifiant invalide ; `403` blocage ; `404` profil inconnu ; `409` déjà amis ou invitation déjà envoyée |
| POST | `/friends/requests/:id/accept` | — | `200 { requestId, status: "accepted" }` ; `404` si je ne suis pas le destinataire d'une invitation en attente |
| POST | `/friends/requests/:id/refuse` | — | `204` (l'expéditeur n'est pas prévenu) ; `404` |
| DELETE | `/friends/requests/:id` | — | `204` : annulation par l'expéditeur ; `404` |
| DELETE | `/friends/:userId` | — | `200 { removed: true, revokedAccesses }` ; `404` si nous ne sommes pas amis |

## Blocage

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/blocks` | — | `200 { blocked: [{ user: { id, name }, blockedAt }] }` |
| POST | `/blocks` | `{ userId }` | `201 { blocked: true, revokedAccesses }` : supprime l'amitié, les invitations et les notifications entre nous ; `400` ; `404` |
| DELETE | `/blocks/:userId` | — | `204` (l'amitié n'est pas rétablie) ; `404` |

## Fil d'activité

### GET `/feed`

- **Réponse `200` :** `{ friendCount, items: [{ type: "track_published" | "mix_published", at, actor: { id, name }, track }] }`.
- Contient les 30 dernières pistes et mixages de mes amis, **limités à ce que j'ai le droit d'écouter** (publics, ou partagés avec moi). La liste est vide si je n'ai pas d'amis.

## Notifications et compteurs

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/notifications` | — | `200 { unread, items: [{ id, type, actor: { id, name }, count, conversationId, track: { id, title } \| null, read, at }] }` (30 dernières) |
| POST | `/notifications/read` | `{ ids? }` | `200 { updated }` : marque comme lues toutes mes notifications, ou seulement celles de `ids` |
| GET | `/me/counters` | — | `200 { messages, notifications, invitations }` : messages non lus, notifications non lues, invitations reçues |

**Types de notification :** `friend_request`, `friend_accepted`, `track_shared`, `message`. Pour les messages, une seule notification non lue est tenue à jour par conversation (`count` = nombre de messages).

## Messagerie

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/conversations` | — | `200 { unread, conversations: [{ id, other: { id, name }, lastMessage: { text, hasTrack, fromMe, at } \| null, unread }] }` |
| POST | `/conversations` | `{ userId }` | `201` créée, ou `200` si elle existait déjà : `{ id, other }` ; `400` ; `403` si la personne n'est pas une amie ou en cas de blocage |
| GET | `/conversations/:id/messages?before&limit` | — | `200 { id, other, canSend, reason: null \| "not_friends" \| "blocked", otherLastReadAt, hasMore, messages }` (du plus ancien au plus récent, `limit` 1 à 100, 50 par défaut) ; `404` si je ne suis pas participant |
| POST | `/conversations/:id/messages` | `{ text?, trackId? }` | `201` message ; `400` vide, plus de 2000 caractères ou `trackId` invalide ; `403` plus amis ou blocage ; `404` conversation inconnue, ou piste qui n'est pas la mienne |
| POST | `/conversations/:id/read` | — | `200 { lastReadAt }` : marque la conversation et sa notification comme lues |

**Format d'un message :** `{ id, fromMe, senderId, text, track, createdAt }`. `track` vaut `null` ou une **carte musicale** :
- `status: "ok"` : champs publics de la piste (`title`, `style`, `coverUrl`, `durationSeconds`, `author`…) ;
- `status: "interrupted"` : l'accès a été retiré, et seuls `id`, `title` et `author` sont donnés. Le frontend affiche « Partage interrompu » ;
- `status: "deleted"` : la piste n'existe plus.

Pour l'expéditeur (propriétaire de la piste), la carte contient aussi `recipientAccess: "active" | "revoked"`.

## Migration 003

- **003-friends-messages** : crée les collections `friendships`, `blocks`, `conversations`, `messages` et `notifications` avec leurs index. Aucune donnée existante n'est modifiée.
- **Annulation (`down`) :** les collections vides sont supprimées ; celles qui contiennent des données sont **renommées** `rollback003_<nom>_<date>`, pas effacées.


# MOST VIBE — étape 4 (sections 8, 9 et 10), 14/10/2026

Toutes les routes ci-dessous exigent un **JWT** (`401` sans jeton, avec un jeton invalide, ou si le compte est suspendu ou supprimé). Un identifiant mal formé donne `404` (ou `400` dans un corps JSON).

## Changements généraux

| Élément | Changement |
|---|---|
| `POST /auth/login` | `403` si le compte est suspendu (le message contient la raison). |
| Jetons | Un compte suspendu ou supprimé voit ses jetons refusés **immédiatement** (`401`), sans attendre leur expiration. |
| Formats audio | `audio/webm` est accepté (enregistrement du studio de mixage). |
| Piste (`Track`) | Nouveaux champs `credits` et `mixProjectId`. `credits` vaut `null` pour une piste, ou `{ remixBy: { id, name }, sources: [{ trackId, title, ownerId, ownerName }], external: [{ title, artist, license, sourceLabel, pageUrl }] }` pour un mixage publié. Il est calculé par le serveur à la publication ; **aucune route ne permet de le modifier** (`PATCH /tracks/:id` l'ignore). |
| `DELETE /tracks/:id` | Supprime aussi les demandes de remix liées à la piste. |
| Notifications | Nouveaux types : `remix_request`, `remix_accepted`, `remix_refused`, `content_removed` (piste dépubliée ou supprimée par l'administration ; dans ce cas, `track.title` est donné même si la piste n'existe plus). Les types coupés dans les paramètres ne sont plus créés (sauf `content_removed`). |
| `POST /friends/requests` | `403` si la personne n'accepte pas d'invitations (paramètre `allowFriendRequests`). Une invitation croisée reste acceptée. |
| `GET /users/search` | N'inclut pas les comptes qui ont choisi `showInSearch: false`, sauf s'ils sont déjà amis avec le lecteur. |

## Section 8 — Projets de mixage

Un projet a la forme `{ id, title, status: "draft" | "published", state, sourceTrackIds, externalIds, publishedTrackIds, publishedAt, createdAt, updatedAt }`.

`state` (nettoyé par le serveur, valeurs bornées, champs inconnus retirés) :
- `{ crossfader (-1 à 1), masterVolume (0 à 1), decks: { A?, B? } }` ;
- chaque platine : `{ source: { kind: "track" | "external", id }, title, position, pitch, pitchRange, eq: { high, mid, low }, filter, fx: { echo, reverb, flanger }, volume }`.

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/mixes` | — | `200 { projects }`, sans `state` mais avec `decks: [{ deck, title }]` |
| POST | `/mixes` | `{ title (1-120), state?, sourceTrackIds?, externalIds? }` | `201` projet ; `400` titre invalide ou plus de 200 projets |
| GET | `/mixes/:id` | — | `200` projet complet ; `404` si ce n'est pas le mien |
| PUT | `/mixes/:id` | `{ title?, state?, sourceTrackIds?, externalIds? }` | `200` projet. Les sources s'**ajoutent** à celles déjà connues (50 au maximum) ; `400` ; `404` |
| DELETE | `/mixes/:id` | — | `204` (les mixages déjà publiés restent) ; `404` |
| GET | `/mixes/:id/check` | — | `200 { sources: [{ trackId, title, owner, status, requestId }], external: [{ id, title, artist, license, blocked }], publishable }` |
| POST | `/mixes/:id/publish` | multipart : `audio` (obligatoire), `cover?`, `title?`, `visibility?` (défaut `private`), `style?` (défaut `electro`), `durationSeconds?` | voir ci-dessous |

**`status` d'une source :**
- `own` : ma piste ;
- `accepted`, `pending`, `refused` : état de ma demande d'autorisation ;
- `none` : pas encore demandé ;
- `unavailable` : piste supprimée ou devenue inaccessible.

Un morceau en ligne est `blocked` si sa licence interdit les œuvres dérivées (« ND »).

**Réponses de `POST /mixes/:id/publish` :**
- `201` : la nouvelle piste (`kind: "mix"`, avec `credits`) ; le projet passe en `published` ;
- `400` : enregistrement absent, titre, style ou visibilité invalide, morceau en ligne sous licence ND, ou morceau en ligne disparu ;
- `403 { message, missing }` : une source appartient à quelqu'un d'autre sans autorisation acceptée ;
- `404` : projet inconnu.

Les fichiers reçus sont supprimés en cas de refus.

> Limite : le serveur ne peut pas analyser l'enregistrement. Il crédite les sources déclarées par le studio (pistes chargées sur les platines pendant le travail), et vérifie pour chacune son existence, le droit d'écoute et l'autorisation.

## Section 8 — Demandes de remix

Une demande a la forme `{ id, track: { id, title }, owner: { id, name }, requester: { id, name }, status: "pending" | "accepted" | "refused", message, createdAt, answeredAt }`.

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/tracks/:id/remix-permission` | — | `200 { status: "own" \| "none" \| "pending" \| "accepted" \| "refused", requestId, message }` ; `403` piste non accessible ; `404` |
| POST | `/tracks/:id/remix-requests` | `{ message? (≤300) }` | `201` demande (notification `remix_request` à l'auteur ; une demande refusée peut être refaite) ; `400` ma propre piste ; `403` piste non accessible ou blocage ; `404` ; `409` déjà en attente ou déjà acceptée |
| GET | `/remix-requests?box=incoming\|outgoing` | — | `200 { requests }` : reçues (par défaut) ou envoyées |
| POST | `/remix-requests/:id/accept` | — | `200` demande (notification `remix_accepted`) ; `404` si je ne suis pas l'auteur ou si elle est déjà traitée |
| POST | `/remix-requests/:id/refuse` | — | `200` demande (notification `remix_refused`) ; `404` |
| DELETE | `/remix-requests/:id` | — | `204` : annulation par le demandeur d'une demande en attente ; `404` |

## Section 9 — Paramètres

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/users/me/settings` | — | `200 { privacy: { allowFriendRequests, showInSearch, defaultVisibility }, notificationPrefs: { friend_request, friend_accepted, message, track_shared, remix }, deleteConsequences: [texte…], deleteConfirmation: "SUPPRIMER" }` |
| PATCH | `/users/me/settings` | `{ privacy?: {...}, notificationPrefs?: {...} }` (booléens ; `defaultVisibility` parmi `private`, `friends`, `public`) | `200 { privacy, notificationPrefs }` ; `400` valeur invalide, clé inconnue ou rien à modifier |
| PUT | `/users/me/password` | `{ currentPassword, newPassword (≥ 8) }` | `204` ; `400` nouveau mot de passe trop court ; `403` mot de passe actuel incorrect |
| DELETE | `/users/me` | `{ password, confirmation: "SUPPRIMER" }` | `204` : compte et données effacés, jetons refusés tout de suite ; `400` confirmation absente ; `403` mot de passe incorrect ; `500` compte supprimé mais un fichier n'a pas pu être effacé (journalisé) |

**Ce que la suppression du compte efface :**
- pistes et fichiers (audio et pochettes), y compris les mixages publiés ;
- playlists, réactions, accès donnés et reçus ;
- amitiés, invitations et blocages ;
- conversations et messages (pour les deux participants) ;
- notifications, demandes de remix, projets de mixage, morceaux en ligne, signalements envoyés.

Dans les crédits des mixages des autres, le nom devient « Compte supprimé ».

## Section 10 — Signalements

### POST `/reports`

- **Corps :** `{ targetType: "track" | "user", targetId, reason: "spam" | "inappropriate" | "copyright" | "harassment" | "other", details? (≤500) }`.
- On ne peut signaler qu'une piste qu'on a le droit d'écouter, ou un profil. Les conversations ne peuvent pas être signalées : l'administration n'y a jamais accès.
- **Réponses :**
  - `201 { id, status: "open" }` ;
  - `400` : motif inconnu, sa propre piste ou soi-même ;
  - `404` : cible inconnue ou non accessible ;
  - `409` : un signalement de ma part est déjà ouvert sur cette cible.

## Section 10 — Administration

Toutes ces routes exigent le rôle `admin`, **relu en base à chaque requête** (`403` sinon). Le rôle ne s'attribue qu'en ligne de commande sur le serveur :

```
npm run role -- <email> admin     # ou user pour le retirer
```

L'administration agit sur les **contenus publics** seulement. Elle n'a aucune route vers les fichiers privés ni vers les conversations : une piste privée ne peut pas être écoutée (`403` comme pour tout autre compte), ni dépubliée, ni supprimée par un admin.

| Méthode | Route | Corps | Réponses |
|---|---|---|---|
| GET | `/admin/overview` | — | `200 { users, suspended, tracks, publicTracks, openReports }` |
| GET | `/admin/reports?status=open\|resolved\|dismissed\|all` | — | `200 { reports: [{ id, targetType, reason, details, status, action, note, createdAt, handledAt, reporter, owner: { id, name, suspended }, track }] }`. Pour une piste devenue non publique, `track = { id, visibility, title: null, hidden: true }` |
| POST | `/admin/reports/:id/resolve` | `{ action: "dismiss" \| "unpublish" \| "delete" \| "suspend", note? }` | `200` signalement traité (les autres signalements ouverts sur la même cible sont clos avec la même décision) ; `400` action invalide ; `403` piste non publique ; `404` |
| GET | `/admin/users?q=` | — | `200 { users: [{ id, name, email, role, createdAt, suspendedAt, suspendedReason, tracks, publicTracks, openReports }] }` (50 au maximum, recherche par nom ou email) |
| POST | `/admin/users/:id/suspend` | `{ reason }` | `200` ; `400` raison absente, admin visé ou soi-même ; `404` |
| DELETE | `/admin/users/:id/suspend` | — | `200` : suspension levée ; `404` si le compte n'était pas suspendu |
| GET | `/admin/tracks?q=` | — | `200 { tracks }` : pistes **publiques** uniquement, avec `openReports` |
| POST | `/admin/tracks/:id/unpublish` | — | `200` : la piste devient privée et l'auteur reçoit `content_removed` ; `403` si elle n'est pas publique |
| DELETE | `/admin/tracks/:id` | — | `204` : piste et fichiers supprimés, l'auteur est prévenu ; `403` si elle n'est pas publique |

## Migration 004

- **004-mixes-settings-admin** :
  - crée les collections `mixprojects`, `remixrequests` et `reports` avec leurs index ;
  - ajoute aux comptes, seulement là où ils manquent, les paramètres par défaut (`privacy`, `notificationPrefs`) et les champs de suspension.
- **Annulation (`down`) :**
  - les collections non vides sont **renommées** (`rollback004_…`) ;
  - les paramètres des comptes sont **copiés** dans `rollback004_usersettings` avant d'être retirés.


# MOST VIBE — étape 5 (sections 11 à 13), 15/10/2026

Aucune route n'est ajoutée ni modifiée. Le comportement général change ainsi :

| Élément | Changement |
|---|---|
| `FRONTEND_DIST` (facultatif) | Si cette variable indique le dossier du site Angular compilé, le serveur le sert aussi. Toute requête `GET` hors de `/api` renvoie un fichier du site ou `index.html`. Les routes `/api/...` restent prioritaires, et une route d'API inconnue répond toujours `404` en JSON. |
| `CORS_ORIGIN` (facultatif) | Liste d'adresses séparées par des virgules. Si elle est définie, seules ces origines reçoivent l'en-tête `Access-Control-Allow-Origin`. Sans elle (développement), toutes les origines sont acceptées. |
| Démarrage en production | Avec `NODE_ENV=production`, le serveur refuse de démarrer si `JWT_SECRET` est absent, fait moins de 32 caractères, ou est la valeur d'exemple. |
| Session côté site | Une réponse `401` à une requête envoyée avec un jeton (session expirée, compte suspendu ou supprimé) déconnecte l'utilisateur et le renvoie à la connexion, avec la raison et la page à retrouver (`/login?reason=expired&returnUrl=…`). Rien ne change côté API. |

## Formats audio acceptés (ajout après la mission, 16/10/2026)

`POST /tracks` (et la publication d'un mix) accepte aussi les fichiers MPEG annoncés autrement que `audio/mpeg` :
- `video/mpeg` : c'est le type que Windows donne aux fichiers `.mpeg` et `.mpg` ;
- `audio/mpg`, `audio/x-mpeg`, `audio/mp3`, `audio/x-mp3`, `audio/mpeg3`, `audio/x-mpeg-3`, `audio/mpga`.

Ils sont **enregistrés avec le type `audio/mpeg`**, pour que les navigateurs les lisent comme du son. Le site vérifie avant l'envoi que le son est lisible : une vidéo MPEG que le navigateur ne sait pas décoder est refusée, avec le conseil de la convertir en MP3. Les autres vidéos (`video/mp4`…) restent refusées (`400`).

