import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AggregatePage } from '../models/page.model';
import { Track } from '../models/track.model';

/** Album public (regroupement des pistes publiques d'un auteur par nom d'album). */
export interface PublicAlbum {
  title: string;
  author: string;
  count: number;
  coverUrl: string | null;
}

export interface PublicHome {
  recent: Track[];
  selection: Track[];
  mixes: Track[];
  albums: PublicAlbum[];
  styles: Partial<Record<string, number>>;
}

export interface PublicSearch {
  q?: string;
  style?: string;
  author?: string;
  album?: string;
  tag?: string;
  kind?: '' | 'track' | 'mix';
  sort?: 'recent' | 'title';
  page?: number;
  limit?: number;
}

/**
 * Contenus publics de MOST VIBE, accessibles sans compte (accueil, explorer, recherche).
 * Le serveur ne renvoie que des pistes publiques, quels que soient les paramètres.
 */
@Injectable({ providedIn: 'root' })
export class PublicService {
  private readonly http = inject(HttpClient);

  home() {
    return this.http.get<PublicHome>('/api/public/home');
  }

  search(query: PublicSearch) {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '' && value !== null) params[key] = value;
    }
    return this.http.get<AggregatePage<Track>>('/api/public/tracks', { params });
  }

  track(id: string) {
    return this.http.get<Track>(`/api/public/tracks/${id}`);
  }
}
