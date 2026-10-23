import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, Observable, of, Subject, switchMap } from 'rxjs';
import { IconName } from '../../shared/icons/icons';
import { Track } from '../../shared/models/track.model';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { CountersService } from '../../shared/services/counters.service';
import { httpMessage, UserSummary } from '../../shared/services/library.service';
import { FeedItem, FriendLink, FriendsResponse, SocialService, UserSearchResult } from '../../shared/services/social.service';
import { IconComponent } from '../icon/icon';
import { TrackTileComponent } from '../track-tile/track-tile';

type Tab = 'feed' | 'friends' | 'invitations' | 'find' | 'blocked';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'feed', label: 'Fil d’activité', icon: 'sparkles' },
  { id: 'friends', label: 'Mes amis', icon: 'users' },
  { id: 'invitations', label: 'Invitations', icon: 'user-plus' },
  { id: 'find', label: 'Trouver des amis', icon: 'search' },
  { id: 'blocked', label: 'Bloqués', icon: 'lock' },
];

/**
 * Section 6 : amis. Fil d'activité de mes amis (limité à ce que j'ai le droit
 * d'écouter), liste d'amis, invitations reçues et envoyées, recherche de
 * profils et comptes bloqués. Toutes les données viennent de la base.
 */
@Component({
  imports: [RouterLink, IconComponent, TrackTileComponent],
  templateUrl: './friends-page.html',
  styleUrl: './friends-page.css',
})
export class FriendsPageComponent implements OnInit {
  private readonly social = inject(SocialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly counters = inject(CountersService);
  readonly player = inject(AudioPlayerService);

  readonly tabs = TABS;
  readonly tab = signal<Tab>('feed');

  readonly feed = signal<FeedItem[] | null>(null);
  readonly friendCount = signal(0);
  readonly feedError = signal('');

  readonly links = signal<FriendsResponse | null>(null);
  readonly linksError = signal('');
  /** Ami dont on demande la confirmation du retrait ou du blocage. */
  readonly confirm = signal<{ userId: string; action: 'remove' | 'block' } | null>(null);

  readonly results = signal<UserSearchResult[]>([]);
  readonly searchMessage = signal('');
  readonly searching = signal(false);
  readonly search$ = new Subject<string>();

  readonly blocked = signal<{ user: UserSummary; blockedAt: string }[] | null>(null);
  readonly blockedError = signal('');

  readonly flash = signal('');
  readonly error = signal('');
  readonly busy = signal('');

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const requested = params.get('tab') as Tab | null;
      const tab = TABS.some((item) => item.id === requested) ? requested! : 'feed';
      this.tab.set(tab);
      this.flash.set('');
      this.error.set('');
      if (tab === 'feed') this.loadFeed();
      if (tab === 'friends' || tab === 'invitations') this.loadLinks();
      if (tab === 'blocked') this.loadBlocked();
    });
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((text) => {
          const q = text.trim();
          this.searchMessage.set(q.length === 1 ? 'Tapez au moins 2 lettres.' : '');
          if (q.length < 2) return of({ users: [] as UserSearchResult[], q });
          this.searching.set(true);
          return this.social.searchUsers(q).pipe(
            switchMap((result) => of({ ...result, q })),
            catchError((error: unknown) => {
              this.searchMessage.set(httpMessage(error, 'Recherche impossible.'));
              return of({ users: [] as UserSearchResult[], q });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ users, q }) => {
        this.searching.set(false);
        this.results.set(users);
        if (q.length >= 2 && !users.length && !this.searchMessage()) this.searchMessage.set(`Aucun profil ne correspond à « ${q} ».`);
      });
  }

  selectTab(tab: Tab): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'feed' ? null : tab } });
  }

  loadFeed(): void {
    this.feedError.set('');
    this.social.feed().subscribe({
      next: ({ items, friendCount }) => {
        this.feed.set(items);
        this.friendCount.set(friendCount);
      },
      error: (error: unknown) => this.feedError.set(httpMessage(error, 'Impossible de charger le fil d’activité.')),
    });
  }

  loadLinks(): void {
    this.linksError.set('');
    this.social.friends().subscribe({
      next: (links) => this.links.set(links),
      error: (error: unknown) => this.linksError.set(httpMessage(error, 'Impossible de charger vos amis.')),
    });
  }

  loadBlocked(): void {
    this.blockedError.set('');
    this.social.blocks().subscribe({
      next: ({ blocked }) => this.blocked.set(blocked),
      error: (error: unknown) => this.blockedError.set(httpMessage(error, 'Impossible de charger la liste.')),
    });
  }

  playFeed(index: number): void {
    const list: Track[] = (this.feed() ?? []).map((item) => item.track);
    if (this.player.current()?.id === list[index].id) this.player.togglePlay();
    else this.player.playList(list, index);
  }

  /** Lance une action, affiche le résultat, puis recharge ce qui a changé. */
  private run(key: string, request: Observable<unknown>, success: string, after: () => void): void {
    this.busy.set(key);
    this.error.set('');
    this.flash.set('');
    request.subscribe({
      next: () => {
        this.busy.set('');
        this.flash.set(success);
        this.confirm.set(null);
        this.counters.refresh();
        after();
      },
      error: (error: unknown) => {
        this.busy.set('');
        this.error.set(httpMessage(error, 'L’action n’a pas pu être faite. Réessayez.'));
      },
    });
  }

  invite(user: UserSearchResult): void {
    this.busy.set(user.id);
    this.error.set('');
    this.social.invite(user.id).subscribe({
      next: (result) => {
        this.busy.set('');
        const relation = result.status === 'accepted' ? 'friend' : 'outgoing';
        this.results.update((list) => list.map((item) => (item.id === user.id ? { ...item, relation, requestId: result.requestId } : item)));
        this.flash.set(result.status === 'accepted' ? `${user.name} vous avait déjà invité : vous êtes maintenant amis.` : `Invitation envoyée à ${user.name}.`);
        this.counters.refresh();
      },
      error: (error: unknown) => {
        this.busy.set('');
        this.error.set(httpMessage(error, 'L’invitation n’a pas pu être envoyée.'));
      },
    });
  }

  accept(link: FriendLink): void {
    this.run(link.requestId, this.social.accept(link.requestId), `Vous êtes maintenant ami(e) avec ${link.user.name}.`, () => this.loadLinks());
  }

  refuse(link: FriendLink): void {
    this.run(link.requestId, this.social.refuse(link.requestId), `Invitation de ${link.user.name} refusée.`, () => this.loadLinks());
  }

  cancel(link: FriendLink): void {
    this.run(link.requestId, this.social.cancel(link.requestId), `Invitation à ${link.user.name} annulée.`, () => this.loadLinks());
  }

  /** Accepter / annuler depuis les résultats de recherche. */
  acceptFromSearch(user: UserSearchResult): void {
    if (!user.requestId) return;
    this.run(user.id, this.social.accept(user.requestId), `Vous êtes maintenant ami(e) avec ${user.name}.`, () =>
      this.results.update((list) => list.map((item) => (item.id === user.id ? { ...item, relation: 'friend', requestId: null } : item))),
    );
  }

  removeFriend(user: UserSummary): void {
    this.busy.set(user.id);
    this.social.removeFriend(user.id).subscribe({
      next: (result) => {
        this.busy.set('');
        this.confirm.set(null);
        this.flash.set(
          `${user.name} ne fait plus partie de vos amis.` + (result.revokedAccesses ? ` ${result.revokedAccesses} accès « Amis choisis » retiré(s) ; un fichier déjà téléchargé ne peut pas être récupéré à distance.` : ''),
        );
        this.loadLinks();
      },
      error: (error: unknown) => {
        this.busy.set('');
        this.error.set(httpMessage(error, 'Le retrait n’a pas pu être fait.'));
      },
    });
  }

  block(user: UserSummary): void {
    this.busy.set(user.id);
    this.social.block(user.id).subscribe({
      next: () => {
        this.busy.set('');
        this.confirm.set(null);
        this.flash.set(`${user.name} est bloqué(e) : vous ne pouvez plus échanger, et ses accès à vos pistes sont retirés.`);
        this.counters.refresh();
        this.loadLinks();
      },
      error: (error: unknown) => {
        this.busy.set('');
        this.error.set(httpMessage(error, 'Le blocage n’a pas pu être fait.'));
      },
    });
  }

  unblock(user: UserSummary): void {
    this.run(user.id, this.social.unblock(user.id), `${user.name} est débloqué(e). Envoyez une nouvelle invitation pour redevenir amis.`, () => this.loadBlocked());
  }

  message(user: UserSummary): void {
    this.busy.set(user.id);
    this.social.openConversation(user.id).subscribe({
      next: (conversation) => {
        this.busy.set('');
        void this.router.navigate(['/messages', conversation.id]);
      },
      error: (error: unknown) => {
        this.busy.set('');
        this.error.set(httpMessage(error, 'Impossible d’ouvrir la conversation.'));
      },
    });
  }

  date(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  initial(name: string): string {
    return name.charAt(0).toUpperCase();
  }
}
