/** Styles musicaux de MOST VIBE (identifiants stables, enregistrés en base). */
// Identifiants en minuscules : ce sont les valeurs enregistrées en base (le libellé affiché est côté site).
export const STYLES = ["hip-hop", "afro", "electro", "pop", "jazz", "rock", "dance", "autres"];

/**
 * Visibilité d'une piste :
 * - private : propriétaire seulement (valeur par défaut) ;
 * - friends : personnes choisies par le propriétaire (section 5) ;
 * - public  : tout le monde, y compris sans compte, et présente dans la recherche.
 */
export const VISIBILITIES = ["private", "friends", "public"];

export const TRACK_KINDS = ["track", "mix"];

export const ROLES = ["user", "admin"];

/** Types de notification qu'un utilisateur peut couper dans ses paramètres (section 9). */
export const NOTIFICATION_PREFS = ["friend_request", "friend_accepted", "message", "track_shared", "remix"];

/** Paramètres par défaut d'un compte (section 9). */
export const DEFAULT_PRIVACY = { allowFriendRequests: true, showInSearch: true, defaultVisibility: "private" };
export const DEFAULT_NOTIFICATION_PREFS = Object.fromEntries(NOTIFICATION_PREFS.map((type) => [type, true]));
