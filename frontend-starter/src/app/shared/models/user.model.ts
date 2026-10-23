/** Public user data returned by the API. */
export interface User {
  id: string;
  name: string;
  email: string;
  /** MOST VIBE : « admin » donne accès à l'espace d'administration (section 10). */
  role?: 'user' | 'admin';
  createdAt: string;
}
