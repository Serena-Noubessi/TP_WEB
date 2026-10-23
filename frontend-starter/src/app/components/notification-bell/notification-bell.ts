import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CountersService } from '../../shared/services/counters.service';
import { httpMessage } from '../../shared/services/library.service';
import { AppNotification, SocialService } from '../../shared/services/social.service';
import { IconComponent } from '../icon/icon';

/**
 * Cloche de notifications : pastille du nombre de notifications non lues, et
 * panneau des dernières notifications. Ouvrir le panneau les marque comme lues ;
 * cliquer une notification mène à la page concernée.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [IconComponent],
  host: { '(document:click)': 'closeOnOutside($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    @let unread = counters.counters().notifications;
    <button type="button" class="bell" (click)="toggle()" [attr.aria-expanded]="open()" aria-haspopup="dialog"
      [attr.aria-label]="unread ? 'Notifications, ' + unread + ' non lue(s)' : 'Notifications'">
      <app-icon name="bell" size="1.2rem" />
      @if (unread) { <span class="badge" aria-hidden="true">{{ unread > 9 ? '9+' : unread }}</span> }
    </button>
    @if (open()) {
      <section class="panel" [class.align-left]="align() === 'left'" role="dialog" aria-label="Notifications">
        <header><strong>Notifications</strong></header>
        @if (loading()) {
          <p class="note" role="status">Chargement…</p>
        } @else if (error()) {
          <p class="note error" role="alert">{{ error() }}</p>
        } @else {
          <ul>
            @for (item of items(); track item.id) {
              <li>
                <button type="button" class="item" [class.unread]="!item.read" (click)="go(item)">
                  <span class="avatar" aria-hidden="true">{{ item.actor.name.charAt(0).toUpperCase() }}</span>
                  <span class="text">{{ describe(item) }}<small>{{ ago(item.at) }}</small></span>
                </button>
              </li>
            } @empty {
              <li class="note"><app-icon name="bell" /> Rien de nouveau. Les invitations, messages et partages apparaîtront ici.</li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; }
    .bell {
      position: relative;
      display: grid;
      width: 2.4rem;
      height: 2.4rem;
      padding: 0;
      place-items: center;
      border: 1px solid var(--mv-border);
      border-radius: 50%;
      color: var(--mv-text);
      background: var(--mv-card);
    }
    .bell:hover { color: var(--mv-primary); background: var(--mv-control-hover); }
    .badge {
      position: absolute;
      top: -0.3rem;
      right: -0.3rem;
      min-width: 1.15rem;
      padding: 0.05rem 0.3rem;
      border-radius: 999px;
      color: var(--mv-on-accent);
      background: var(--mv-danger);
      font-size: 0.68rem;
      font-weight: 800;
      line-height: 1.1rem;
    }
    .panel {
      position: absolute;
      z-index: 80;
      top: calc(100% + 0.5rem);
      right: 0;
      width: min(22rem, calc(100vw - 2rem));
      max-height: min(28rem, 70vh);
      overflow-y: auto;
      padding: 0.6rem;
      border: 1px solid var(--mv-border);
      border-radius: 14px;
      background: var(--mv-card);
      box-shadow: var(--mv-shadow);
    }
    /* Depuis le menu latéral : panneau fixe à droite du menu, pour ne pas être coupé par son bord. */
    .panel.align-left { position: fixed; top: 1rem; right: auto; left: calc(var(--sidebar-width, 15.5rem) + 0.5rem); }
    header { padding: 0.2rem 0.4rem 0.5rem; }
    ul { display: grid; gap: 0.2rem; margin: 0; padding: 0; list-style: none; }
    .item {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem;
      border: 0;
      border-radius: 10px;
      color: var(--mv-text);
      background: transparent;
      font-weight: 500;
      text-align: left;
    }
    .item:hover { background: var(--mv-control-hover); }
    .item.unread { background: var(--mv-primary-soft); font-weight: 700; }
    .avatar { display: grid; flex: 0 0 2rem; height: 2rem; place-items: center; border-radius: 50%; color: var(--mv-on-accent); background: var(--mv-secondary-strong); font-weight: 800; }
    .text { display: grid; gap: 0.1rem; font-size: 0.86rem; }
    .text small { color: var(--mv-muted); font-weight: 400; }
    .note { display: flex; gap: 0.4rem; margin: 0; padding: 0.6rem; color: var(--mv-muted); font-size: 0.85rem; }
    .note.error { color: var(--mv-danger-strong); }
  `,
})
export class NotificationBellComponent {
  readonly counters = inject(CountersService);
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** « left » : cloche du menu vertical (panneau ouvert à côté du menu) ; « right » : en-tête mobile. */
  readonly align = input<'left' | 'right'>('right');
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly items = signal<AppNotification[]>([]);

  toggle(): void {
    const open = !this.open();
    this.open.set(open);
    if (!open) return;
    this.loading.set(true);
    this.error.set('');
    this.social.notifications().subscribe({
      next: ({ items, unread }) => {
        this.items.set(items);
        this.loading.set(false);
        if (unread) {
          this.social.markNotificationsRead().subscribe({ next: () => this.counters.refresh(), error: () => undefined });
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(httpMessage(error, 'Impossible de charger les notifications.'));
      },
    });
  }

  describe(item: AppNotification): string {
    const who = item.actor.name;
    switch (item.type) {
      case 'friend_request':
        return `${who} vous invite à devenir amis`;
      case 'friend_accepted':
        return `${who} a accepté votre invitation`;
      case 'track_shared':
        return `${who} a partagé « ${item.track?.title ?? 'une piste'} » avec vous`;
      case 'message':
        return item.count > 1 ? `${who} vous a envoyé ${item.count} messages` : `${who} vous a envoyé un message`;
      case 'remix_request':
        return `${who} demande à remixer « ${item.track?.title ?? 'votre piste'} »`;
      case 'remix_accepted':
        return `${who} accepte que vous remixiez « ${item.track?.title ?? 'sa piste'} »`;
      case 'remix_refused':
        return `${who} refuse le remix de « ${item.track?.title ?? 'sa piste'} »`;
      case 'content_removed':
        return `L’administration a retiré « ${item.track?.title ?? 'une de vos pistes'} » de l’espace public`;
    }
  }

  go(item: AppNotification): void {
    this.open.set(false);
    if (item.type === 'friend_request') void this.router.navigate(['/friends'], { queryParams: { tab: 'invitations' } });
    else if (item.type === 'friend_accepted') void this.router.navigate(['/u', item.actor.id]);
    else if (item.type === 'message' && item.conversationId) void this.router.navigate(['/messages', item.conversationId]);
    else if (item.type.startsWith('remix_')) void this.router.navigate(['/library'], { queryParams: { tab: 'mixes' } });
    else if (item.type === 'content_removed') void this.router.navigate(['/library']);
    else void this.router.navigate(['/library'], { queryParams: { tab: 'shared' } });
  }

  ago(value: string): string {
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return 'à l’instant';
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  closeOnOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
