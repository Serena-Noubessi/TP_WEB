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
