import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { UserSummary } from './library.service';

export interface TrackComment {
  id: string;
  text: string;
  author: UserSummary;
  createdAt: string;
  /** Écrit par moi. */
  mine: boolean;
  /** Je peux le supprimer (j'en suis l'auteur ou la piste est à moi). */
  canDelete: boolean;
}

export interface CommentPage {
  total: number;
  hasMore: boolean;
  /** Faux pour un visiteur ou en cas de blocage avec l'auteur de la piste. */
  canComment: boolean;
  comments: TrackComment[];
}

/** Longueur maximale d'un commentaire (vérifiée aussi par le serveur). */
export const COMMENT_MAX_LENGTH = 1000;

/**
 * Commentaires d'une piste. Le serveur applique la même règle que pour l'écoute :
 * on lit et on écrit seulement sur une piste qu'on a le droit d'écouter.
 */
@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly http = inject(HttpClient);

  list(trackId: string, before?: string) {
    const params: Record<string, string> = before ? { before } : {};
    return this.http.get<CommentPage>(`/api/tracks/${trackId}/comments`, { params });
  }

  add(trackId: string, text: string) {
    return this.http.post<TrackComment>(`/api/tracks/${trackId}/comments`, { text });
  }

  remove(commentId: string) {
    return this.http.delete<void>(`/api/comments/${commentId}`);
  }
}
