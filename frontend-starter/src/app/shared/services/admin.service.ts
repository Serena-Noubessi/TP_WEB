import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Track } from '../models/track.model';
import { UserSummary } from './library.service';

export type ReportReason = 'spam' | 'inappropriate' | 'copyright' | 'harassment' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'inappropriate', label: 'Contenu inapproprié' },
  { id: 'copyright', label: 'Droits d’auteur (contenu copié)' },
  { id: 'harassment', label: 'Harcèlement ou propos haineux' },
  { id: 'spam', label: 'Spam ou publicité' },
  { id: 'other', label: 'Autre' },
];

export interface AdminReport {
  id: string;
  targetType: 'track' | 'user';
  reason: ReportReason;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  action: 'none' | 'unpublished' | 'deleted' | 'suspended';
  note: string;
  createdAt: string;
  handledAt: string | null;
  reporter: UserSummary;
  owner: UserSummary & { suspended: boolean };
  track: { id: string; title: string | null; kind?: string; visibility?: string; coverUrl?: string | null; hidden?: boolean; deleted?: boolean } | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string;
  tracks: number;
  publicTracks: number;
  openReports: number;
}

export interface AdminOverview {
  users: number;
  suspended: number;
  tracks: number;
  publicTracks: number;
  openReports: number;
}

/** Appels HTTP de la section 10 : signaler (tout membre) et administrer (admins seulement). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  report(targetType: 'track' | 'user', targetId: string, reason: ReportReason, details: string) {
    return this.http.post<{ id: string; status: string }>('/api/reports', { targetType, targetId, reason, details });
  }

  overview() {
    return this.http.get<AdminOverview>('/api/admin/overview');
  }

  reports(status: 'open' | 'resolved' | 'dismissed' | 'all') {
    return this.http.get<{ reports: AdminReport[] }>('/api/admin/reports', { params: { status } });
  }

  resolve(reportId: string, action: 'dismiss' | 'unpublish' | 'delete' | 'suspend', note: string) {
    return this.http.post<AdminReport>(`/api/admin/reports/${reportId}/resolve`, { action, note });
  }

  users(q: string) {
    return this.http.get<{ users: AdminUser[] }>('/api/admin/users', { params: q ? { q } : {} });
  }

  suspend(userId: string, reason: string) {
    return this.http.post<{ suspended: boolean }>(`/api/admin/users/${userId}/suspend`, { reason });
  }

  unsuspend(userId: string) {
    return this.http.delete<{ suspended: boolean }>(`/api/admin/users/${userId}/suspend`);
  }

  tracks(q: string) {
    return this.http.get<{ tracks: (Track & { openReports: number })[] }>('/api/admin/tracks', { params: q ? { q } : {} });
  }

  unpublish(trackId: string) {
    return this.http.post<{ unpublished: boolean }>(`/api/admin/tracks/${trackId}/unpublish`, {});
  }

  deleteTrack(trackId: string) {
    return this.http.delete<void>(`/api/admin/tracks/${trackId}`);
  }
}
