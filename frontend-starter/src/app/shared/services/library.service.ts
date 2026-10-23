import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Track, TrackVisibility } from '../models/track.model';

export type ReactionType = 'like' | 'favorite';

export interface ReactionResult {
  trackId: string;
  type: ReactionType;
  active: boolean;
  likeCount: number;
}

export interface UserSummary {
  id: string;
  name: string;
}

export interface AccessGrant {
  user: UserSummary;
  via: 'share' | 'message';
  grantedAt: string;
  revokedAt: string | null;
  active: boolean;
}

export interface AccessList {
  trackId: string;
  visibility: TrackVisibility;
  grants: AccessGrant[];
  /** Présent après un retrait : rappel qu'un fichier déjà téléchargé ne peut pas être récupéré. */
  notice?: string;
}

export interface Album {
  title: string;
  count: number;
  publicCount: number;
  trackIds: string[];
  coverUrl: string | null;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: 'private' | 'public';
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistDetail extends Playlist {
  tracks: Track[];
  hiddenCount: number;
}

export type SharedTrack = Track & { sharedVia: 'share' | 'message'; sharedAt: string };

/** Appels HTTP de l'espace personnel (sections 4 et 5). Toutes ces routes exigent un compte. */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);

  react(trackId: string, type: ReactionType, active: boolean) {
    const url = `/api/tracks/${trackId}/${type}`;
    return active ? this.http.post<ReactionResult>(url, {}) : this.http.delete<ReactionResult>(url);
  }

  reactions() {
    return this.http.get<{ likes: string[]; favorites: string[] }>('/api/me/reactions');
  }

  favorites() {
    return this.http.get<{ docs: Track[] }>('/api/me/favorites');
  }

  shared() {
    return this.http.get<{ docs: SharedTrack[] }>('/api/me/shared');
  }

  albums() {
    return this.http.get<{ albums: Album[] }>('/api/me/albums');
  }

  access(trackId: string) {
    return this.http.get<AccessList>(`/api/tracks/${trackId}/access`);
  }

  grant(trackId: string, userIds: string[]) {
    return this.http.post<AccessList>(`/api/tracks/${trackId}/access`, { userIds });
  }

  revoke(trackId: string, userId: string) {
    return this.http.delete<AccessList>(`/api/tracks/${trackId}/access/${userId}`);
  }

  searchUsers(q: string) {
    return this.http.get<{ users: UserSummary[] }>('/api/users/search', { params: { q } });
  }

  playlists() {
    return this.http.get<{ playlists: Playlist[] }>('/api/playlists');
  }

  playlist(id: string) {
    return this.http.get<PlaylistDetail>(`/api/playlists/${id}`);
  }

  createPlaylist(body: { name: string; description?: string; visibility?: 'private' | 'public' }) {
    return this.http.post<Playlist>('/api/playlists', body);
  }

  updatePlaylist(id: string, body: Partial<Pick<Playlist, 'name' | 'description' | 'visibility'>>) {
    return this.http.patch<Playlist>(`/api/playlists/${id}`, body);
  }

  deletePlaylist(id: string) {
    return this.http.delete<void>(`/api/playlists/${id}`);
  }

  addToPlaylist(id: string, trackId: string) {
    return this.http.post<Playlist>(`/api/playlists/${id}/tracks`, { trackId });
  }

  removeFromPlaylist(id: string, trackId: string) {
    return this.http.delete<Playlist>(`/api/playlists/${id}/tracks/${trackId}`);
  }
}

/** Message d'erreur lisible à partir d'une réponse HTTP en échec. */
export function httpMessage(error: unknown, fallback: string): string {
  const response = error as { status?: number; error?: { message?: string } | string };
  if (response?.status === 0 || response?.status === 502 || response?.status === 503 || response?.status === 504) {
    return 'Le serveur ne répond pas. Vérifiez votre connexion et réessayez.';
  }
  const message = typeof response?.error === 'object' && response.error !== null ? response.error.message : undefined;
  return message ?? fallback;
}
