import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { IconName } from '../../shared/icons/icons';
import { Track } from '../../shared/models/track.model';
import { AdminOverview, AdminReport, AdminService, AdminUser, REPORT_REASONS } from '../../shared/services/admin.service';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { httpMessage } from '../../shared/services/library.service';
import { IconComponent } from '../icon/icon';

type Tab = 'overview' | 'reports' | 'users' | 'tracks';
type ReportFilter = 'open' | 'resolved' | 'dismissed' | 'all';
type ReportAction = 'dismiss' | 'unpublish' | 'delete' | 'suspend';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Tableau de bord', icon: 'gauge' },
  { id: 'reports', label: 'Signalements', icon: 'flag' },
  { id: 'users', label: 'Utilisateurs', icon: 'users' },
  { id: 'tracks', label: 'Contenus publics', icon: 'globe' },
];

const ACTION_LABELS: Record<ReportAction, string> = {
  dismiss: 'Classer sans suite',
  unpublish: 'Dépublier la piste',
  delete: 'Supprimer la piste',
  suspend: 'Suspendre l’auteur',
};

/**
 * Section 10 : espace d'administration (rôle admin vérifié par le serveur à
 * chaque requête). Signalements, utilisateurs, contenus PUBLICS. Aucune vue
 * sur les pistes privées ni sur les conversations.
 */
@Component({
  imports: [IconComponent, RouterLink],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.css',
})
export class AdminPageComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly player = inject(AudioPlayerService);

  readonly tabs = TABS;
  readonly actionLabels = ACTION_LABELS;
  readonly reasons = new Map(REPORT_REASONS.map((reason) => [reason.id, reason.label]));
  readonly tab = signal<Tab>('overview');
  readonly forbidden = signal(false);
  readonly error = signal('');
  readonly flash = signal('');
  readonly busy = signal('');

  readonly overview = signal<AdminOverview | null>(null);
  readonly reportFilter = signal<ReportFilter>('open');
  readonly reports = signal<AdminReport[] | null>(null);
  /** Action en attente de confirmation : { id du signalement / de la piste / du compte, action }. */
  readonly confirm = signal<{ id: string; action: string } | null>(null);
  readonly users = signal<AdminUser[] | null>(null);
  readonly tracks = signal<(Track & { openReports: number })[] | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const requested = params.get('tab') as Tab | null;
      const tab = TABS.some((item) => item.id === requested) ? requested! : 'overview';
      this.tab.set(tab);
      this.flash.set('');
      this.error.set('');
      this.confirm.set(null);
      this.load(tab);
    });
  }

  selectTab(tab: Tab): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'overview' ? null : tab } });
  }

  /** Une réponse 403 signifie « pas administrateur » : on l'affiche clairement. */
  private fail(error: unknown, fallback: string): void {
    if ((error as { status?: number }).status === 403 && !this.reports() && !this.users() && !this.overview()) this.forbidden.set(true);
    this.error.set(httpMessage(error, fallback));
  }

  load(tab: Tab): void {
    if (tab === 'overview') this.admin.overview().subscribe({ next: (data) => this.overview.set(data), error: (error) => this.fail(error, 'Tableau de bord indisponible.') });
    if (tab === 'reports') this.loadReports();
    if (tab === 'users') this.searchUsers('');
    if (tab === 'tracks') this.searchTracks('');
  }

  loadReports(filter = this.reportFilter()): void {
    this.reportFilter.set(filter);
    this.reports.set(null);
    this.admin.reports(filter).subscribe({ next: ({ reports }) => this.reports.set(reports), error: (error) => this.fail(error, 'Signalements indisponibles.') });
  }

  searchUsers(q: string): void {
    this.admin.users(q.trim()).subscribe({ next: ({ users }) => this.users.set(users), error: (error) => this.fail(error, 'Utilisateurs indisponibles.') });
  }

  searchTracks(q: string): void {
    this.admin.tracks(q.trim()).subscribe({ next: ({ tracks }) => this.tracks.set(tracks), error: (error) => this.fail(error, 'Contenus indisponibles.') });
  }

  private run(key: string, request: Observable<unknown>, success: string, after: () => void): void {
    this.busy.set(key);
    this.error.set('');
    this.flash.set('');
    request.subscribe({
      next: () => {
        this.busy.set('');
        this.confirm.set(null);
        this.flash.set(success);
        after();
      },
      error: (error: unknown) => {
        this.busy.set('');
        this.error.set(httpMessage(error, 'L’action n’a pas pu être faite.'));
      },
    });
  }

  resolve(report: AdminReport, action: ReportAction, note: string): void {
    this.run(report.id, this.admin.resolve(report.id, action, note.trim()), `Signalement traité : ${ACTION_LABELS[action].toLowerCase()}.`, () => this.loadReports());
  }

  suspend(user: AdminUser, reason: string): void {
    if (!reason.trim()) {
      this.error.set('Indiquez la raison de la suspension (elle est montrée à la personne à sa connexion).');
      return;
    }
    this.run(user.id, this.admin.suspend(user.id, reason.trim()), `${user.name} est suspendu(e).`, () => this.searchUsers(''));
  }

  unsuspend(user: AdminUser): void {
    this.run(user.id, this.admin.unsuspend(user.id), `Suspension de ${user.name} levée.`, () => this.searchUsers(''));
  }

  unpublish(track: Track): void {
    this.run(track.id, this.admin.unpublish(track.id), `« ${track.title} » est dépubliée (redevenue privée). Son auteur est prévenu.`, () => this.searchTracks(''));
  }

  deleteTrack(track: Track): void {
    this.run(track.id, this.admin.deleteTrack(track.id), `« ${track.title} » est supprimée. Son auteur est prévenu.`, () => this.searchTracks(''));
  }

  actionLabel(action: string): string {
    return ACTION_LABELS[action as ReportAction] ?? action;
  }

  isPlaying(track: Track): boolean {
    return this.player.current()?.id === track.id && this.player.playing();
  }

  play(track: Track): void {
    if (this.player.current()?.id === track.id) this.player.togglePlay();
    else this.player.playList([track], 0);
  }

  date(value: string | null): string {
    return value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
}
