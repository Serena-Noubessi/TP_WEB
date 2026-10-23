import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TrackPageResponse } from '../models/page.model';
import { Track, TrackMeta } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  /** Mes pistes, paginées ; `style` filtre par style (MOST VIBE). */
  list(page = 1, limit = 5, search = '', style = '') {
    const params: Record<string, string | number> = { page, limit };
    if (search) params['search'] = search;
    if (style) params['style'] = style;
    return this.http.get<TrackPageResponse<Track>>('/api/tracks', { params });
  }

  upload(file: File, title: string, cover?: File, meta: TrackMeta = {}) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    if (cover) body.append('cover', cover);
    for (const key of ['style', 'visibility', 'tags', 'album'] as const) {
      const value = meta[key];
      if (value) body.append(key, value);
    }
    if (meta.durationSeconds) body.append('durationSeconds', String(meta.durationSeconds));
    return this.http.post<Track>('/api/tracks', body, {
      observe: 'events',
      reportProgress: true,
    });
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  cover(id: string) {
    return this.http.get(`/api/tracks/${id}/cover`, {
      responseType: 'blob',
    });
  }

  /** Modifie le titre, le style, la visibilité, les tags ou l'album (propriétaire seulement). */
  update(id: string, changes: TrackMeta) {
    return this.http.patch<Track>(`/api/tracks/${id}`, changes);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}
