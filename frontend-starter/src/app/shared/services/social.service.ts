import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Track } from '../models/track.model';
import { UserSummary } from './library.service';

export type Relation = 'self' | 'friend' | 'outgoing' | 'incoming' | 'none';

export interface UserSearchResult extends UserSummary {
  relation: Exclude<Relation, 'self'>;
  requestId: string | null;
}

export interface FriendLink {
  requestId: string;
  user: UserSummary;
  createdAt: string;
  acceptedAt: string | null;
}

export interface FriendsResponse {
  friends: FriendLink[];
  incoming: FriendLink[];
  outgoing: FriendLink[];
}

export interface PublicProfile extends UserSummary {
  memberSince: string;
  relation: Relation;
  requestId: string | null;
  friendCount: number;
  tracks: Track[];
}

export interface FeedItem {
  type: 'track_published' | 'mix_published';
  at: string;
  actor: UserSummary;
  track: Track;
}

export interface AppNotification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'message' | 'track_shared' | 'remix_request' | 'remix_accepted' | 'remix_refused' | 'content_removed';
  actor: UserSummary;
  count: number;
  conversationId: string | null;
  track: { id: string; title: string | null } | null;
  read: boolean;
  at: string;
}

export interface Counters {
  messages: number;
  notifications: number;
  invitations: number;
}

export interface ConversationSummary {
  id: string;
  other: UserSummary;
  lastMessage: { text: string; hasTrack: boolean; fromMe: boolean; at: string } | null;
  unread: number;
}

/** Carte musicale d'un message (droits revérifiés par le serveur à chaque lecture). */
export type TrackCard =
  | (Track & { status: 'ok'; recipientAccess?: 'active' | 'revoked' })
  | { id: string; status: 'interrupted'; title: string; author: UserSummary | null; recipientAccess?: 'active' | 'revoked' }
  | { id: string; status: 'deleted' };

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  senderId: string;
  text: string;
  track: TrackCard | null;
  createdAt: string;
}

export interface ConversationThread {
  id: string;
  other: UserSummary;
  canSend: boolean;
  reason: null | 'not_friends' | 'blocked';
  otherLastReadAt: string;
  hasMore: boolean;
  messages: ChatMessage[];
}

/** Appels HTTP des sections 6 (amis, blocage, fil) et 7 (messagerie), plus les notifications. */
@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly http = inject(HttpClient);

  searchUsers(q: string) {
    return this.http.get<{ users: UserSearchResult[] }>('/api/users/search', { params: { q } });
  }

  profile(userId: string) {
    return this.http.get<PublicProfile>(`/api/users/${userId}/profile`);
  }

  friends() {
    return this.http.get<FriendsResponse>('/api/friends');
  }

  invite(userId: string) {
    return this.http.post<{ requestId: string; status: 'pending' | 'accepted' }>('/api/friends/requests', { userId });
  }

  accept(requestId: string) {
    return this.http.post<{ requestId: string; status: 'accepted' }>(`/api/friends/requests/${requestId}/accept`, {});
  }

  refuse(requestId: string) {
    return this.http.post<void>(`/api/friends/requests/${requestId}/refuse`, {});
  }

  cancel(requestId: string) {
    return this.http.delete<void>(`/api/friends/requests/${requestId}`);
  }

  removeFriend(userId: string) {
    return this.http.delete<{ removed: boolean; revokedAccesses: number }>(`/api/friends/${userId}`);
  }

  blocks() {
    return this.http.get<{ blocked: { user: UserSummary; blockedAt: string }[] }>('/api/blocks');
  }

  block(userId: string) {
    return this.http.post<{ blocked: boolean; revokedAccesses: number }>('/api/blocks', { userId });
  }

  unblock(userId: string) {
    return this.http.delete<void>(`/api/blocks/${userId}`);
  }

  feed() {
    return this.http.get<{ items: FeedItem[]; friendCount: number }>('/api/feed');
  }

  notifications() {
    return this.http.get<{ unread: number; items: AppNotification[] }>('/api/notifications');
  }

  markNotificationsRead(ids?: string[]) {
    return this.http.post<{ updated: number }>('/api/notifications/read', ids ? { ids } : {});
  }

  counters() {
    return this.http.get<Counters>('/api/me/counters');
  }

  conversations() {
    return this.http.get<{ conversations: ConversationSummary[]; unread: number }>('/api/conversations');
  }

  openConversation(userId: string) {
    return this.http.post<{ id: string; other: UserSummary }>('/api/conversations', { userId });
  }

  messages(conversationId: string, before?: string) {
    return this.http.get<ConversationThread>(`/api/conversations/${conversationId}/messages`, { params: before ? { before } : {} });
  }

  send(conversationId: string, body: { text?: string; trackId?: string }) {
    return this.http.post<ChatMessage>(`/api/conversations/${conversationId}/messages`, body);
  }

  markRead(conversationId: string) {
    return this.http.post<{ lastReadAt: string }>(`/api/conversations/${conversationId}/read`, {});
  }
}
