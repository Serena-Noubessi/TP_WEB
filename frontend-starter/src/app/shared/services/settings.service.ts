import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TrackVisibility } from '../models/track.model';

export interface PrivacySettings {
  allowFriendRequests: boolean;
  showInSearch: boolean;
  defaultVisibility: TrackVisibility;
}

export type NotificationPref = 'friend_request' | 'friend_accepted' | 'message' | 'track_shared' | 'remix';

export interface AccountSettings {
  privacy: PrivacySettings;
  notificationPrefs: Record<NotificationPref, boolean>;
  deleteConsequences?: string[];
  deleteConfirmation?: string;
}

/** Appels HTTP de la section 9 : paramètres, mot de passe, suppression du compte. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);

  get() {
    return this.http.get<AccountSettings>('/api/users/me/settings');
  }

  update(changes: { privacy?: Partial<PrivacySettings>; notificationPrefs?: Partial<Record<NotificationPref, boolean>> }) {
    return this.http.patch<AccountSettings>('/api/users/me/settings', changes);
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<void>('/api/users/me/password', { currentPassword, newPassword });
  }

  deleteAccount(password: string, confirmation: string) {
    return this.http.delete<void>('/api/users/me', { body: { password, confirmation } });
  }
}
