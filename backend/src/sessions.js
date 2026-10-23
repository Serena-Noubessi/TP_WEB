/**
 * Comptes dont les jetons de connexion doivent être refusés immédiatement
 * (section 10 : compte suspendu ; section 9 : compte supprimé).
 * Un JWT reste valable 2 h : sans cette liste, un compte suspendu pourrait
 * continuer à agir jusqu'à l'expiration de son jeton.
 *
 * La liste est gardée en mémoire (vérification instantanée à chaque requête)
 * et rechargée depuis la base au démarrage du serveur (comptes suspendus).
 */
const revoked = new Set();

export function revokeSessions(userId) {
  revoked.add(String(userId));
}

export function restoreSessions(userId) {
  revoked.delete(String(userId));
}

export function isRevoked(userId) {
  return revoked.has(String(userId));
}

/** Recharge les comptes suspendus (appelé au démarrage, après la connexion à MongoDB). */
export async function loadSuspended(User) {
  const users = await User.find({ suspendedAt: { $ne: null } }).select("_id").lean();
  for (const user of users) revoked.add(String(user._id));
  return users.length;
}
