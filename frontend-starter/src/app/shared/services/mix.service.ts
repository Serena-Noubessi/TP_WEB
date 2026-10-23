import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MixState } from '../models/dj.model';
import { Track, TrackVisibility } from '../models/track.model';
import { UserSummary } from './library.service';

export interface MixProject {
  id: string;
  title: string;
  status: 'draft' | 'published';
  state: MixState;
  sourceTrackIds: string[];
  externalIds: string[];
  publishedTrackIds: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MixProjectSummary = Omit<MixProject, 'state'> & { decks: { deck: string; title: string }[] };

export type SourceStatus = 'own' | 'accepted' | 'pending' | 'refused' | 'none' | 'unavailable';

export interface MixCheck {
  sources: { trackId: string; title: string; owner: UserSummary | null; status: SourceStatus; requestId: string | null }[];
  external: { id: string; title: string; artist: string; license: string; blocked: boolean }[];
  publishable: boolean;
}

export interface RemixRequest {
  id: string;
  track: { id: string; title: string };
  owner: UserSummary;
  requester: UserSummary;
  status: 'pending' | 'accepted' | 'refused';
  message: string;
  createdAt: string;
  answeredAt: string | null;
}

export interface PublishFields {
  title: string;
  visibility: TrackVisibility;
  style: string;
  durationSeconds?: number;
  cover?: File;
}

/** Appels HTTP de la section 8 : projets de mixage, publication et demandes de remix. */
@Injectable({ providedIn: 'root' })
export class MixService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<{ projects: MixProjectSummary[] }>('/api/mixes');
  }

  get(id: string) {
    return this.http.get<MixProject>(`/api/mixes/${id}`);
  }

  create(body: { title: string; state: MixState; sourceTrackIds?: string[]; externalIds?: string[] }) {
    return this.http.post<MixProject>('/api/mixes', body);
  }

  update(id: string, body: { title?: string; state?: MixState; sourceTrackIds?: string[]; externalIds?: string[] }) {
    return this.http.put<MixProject>(`/api/mixes/${id}`, body);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/mixes/${id}`);
  }

  check(id: string) {
    return this.http.get<MixCheck>(`/api/mixes/${id}/check`);
  }

  publish(id: string, recording: Blob, fields: PublishFields) {
    const body = new FormData();
    const extension = recording.type.includes('ogg') ? 'ogg' : 'webm';
    body.append('audio', recording, `mix.${extension}`);
    body.append('title', fields.title);
    body.append('visibility', fields.visibility);
    body.append('style', fields.style);
    if (fields.durationSeconds) body.append('durationSeconds', String(fields.durationSeconds));
    if (fields.cover) body.append('cover', fields.cover);
    return this.http.post<Track>(`/api/mixes/${id}/publish`, body, { observe: 'events', reportProgress: true });
  }

  permission(trackId: string) {
    return this.http.get<{ status: SourceStatus; requestId: string | null; message?: string }>(`/api/tracks/${trackId}/remix-permission`);
  }

  requestRemix(trackId: string, message: string) {
    return this.http.post<RemixRequest>(`/api/tracks/${trackId}/remix-requests`, { message });
  }

  requests(box: 'incoming' | 'outgoing') {
    return this.http.get<{ requests: RemixRequest[] }>('/api/remix-requests', { params: { box } });
  }

  answer(requestId: string, accept: boolean) {
    return this.http.post<RemixRequest>(`/api/remix-requests/${requestId}/${accept ? 'accept' : 'refuse'}`, {});
  }

  cancelRequest(requestId: string) {
    return this.http.delete<void>(`/api/remix-requests/${requestId}`);
  }
}
