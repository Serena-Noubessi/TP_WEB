import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TrackPageResponse } from '../models/page.model';
import { Track } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 5, search = '') {
    return this.http.get<TrackPageResponse<Track>>('/api/tracks', {
      params: search ? { page, limit, search } : { page, limit },
    });
  }

  upload(file: File, title: string, cover?: File) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    if (cover) body.append('cover', cover);
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

  delete(id: string) {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}
