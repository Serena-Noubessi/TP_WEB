# Schéma annoté du flux de connexion

Le diagramme décrit la connexion par le formulaire Angular, la vérification des
identifiants par l'API Express et l'accès à la page des pistes.

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant L as LoginPage Angular
    participant A as AuthService
    participant P as Proxy Angular :4200
    participant API as API Express :3000
    participant DB as MongoDB Atlas
    participant G as Guard / Intercepteur

    U->>L: Saisit email et mot de passe
    U->>L: Clique sur « Se connecter »
    Note over L: Vérifie les champs du formulaire
    L->>A: login(email, password)
    A->>P: POST /api/auth/login {email, password}
    Note over P,API: Le proxy transmet /api vers localhost:3000
    P->>API: POST /api/auth/login
    Note over API: express.json() lit le corps JSON
    API->>API: Met l'email en minuscules
    API->>DB: Recherche l'utilisateur et son passwordHash
    DB-->>API: Utilisateur trouvé ou absent
    API->>API: Vérifie l'utilisateur, puis compare le mot de passe avec bcrypt

    alt Identifiant inconnu ou mot de passe incorrect
        API-->>P: 401 {message: "Identifiants incorrects"}
        P-->>A: Réponse HTTP 401
        A-->>L: Erreur de la requête
        L-->>U: Affiche le message d'erreur
    else Identifiants valides
        API->>API: Crée un JWT (sub, email), valable 2 heures
        API-->>P: 200 {token, user public}
        P-->>A: Réponse HTTP 200
        A->>A: Stocke le token dans localStorage (gpc_token)
        A->>A: Met à jour les signaux token et currentUser
        A-->>L: Connexion réussie
        L->>U: Redirige vers /tracks
        L->>G: Le guard protège la route /tracks
        G->>G: Vérifie la présence du token
        G-->>L: Autorise l'accès si le token existe
    end

    Note over G,API: Pour les requêtes API ultérieures, l'intercepteur ajoute Authorization: Bearer <token>.
    Note over API,DB: Le middleware auth vérifie le JWT avant d'autoriser une route protégée.
```

## À retenir

- Le mot de passe est envoyé à l'API pour vérification, mais il n'est jamais
  stocké dans le navigateur ni inclus dans le JWT.
- La réponse de connexion contient le JWT et les données publiques de
  l'utilisateur; le hash du mot de passe n'est pas renvoyé.
- Une erreur réseau (API arrêtée ou inaccessible) n'est pas un refus
  d'identifiants : l'interface affiche alors son message générique « Erreur de
  connexion ».
- Le guard vérifie seulement que le token existe côté frontend. C'est le
  middleware backend qui valide réellement le JWT lors des requêtes protégées.

## Fichiers concernés

- `frontend-starter/src/app/components/login-page/login-page.ts`
- `frontend-starter/src/app/shared/services/auth.service.ts`
- `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`
- `frontend-starter/src/app/shared/guards/auth.guard.ts`
- `backend/src/app.js`
- `backend/src/server.js`