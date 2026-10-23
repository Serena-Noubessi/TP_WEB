import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { CountersService } from '../../shared/services/counters.service';
import { httpMessage } from '../../shared/services/library.service';
import { PublicProfile, SocialService } from '../../shared/services/social.service';
import { IconComponent } from '../icon/icon';
import { TrackTileComponent } from '../track-tile/track-tile';
import { ReportDialogComponent } from '../report-dialog/report-dialog';

/**
 * Profil public d'un membre (section 6) : nom, nombre d'amis, relation avec
 * moi (inviter, accepter, écrire, retirer, bloquer) et ses pistes que j'ai le
 * droit d'écouter. Le serveur répond 404 si l'un de nous a bloqué l'autre.
 */
@Component({
  imports: [RouterLink, IconComponent, TrackTileComponent, ReportDialogComponent],
  template: `
    <section class="profile-page">
      @if (error()) {
        <div class="state error" role="alert">
          {{ error() }}
          <a routerLink="/friends" [queryParams]="{ tab: 'find' }">Chercher un autre profil</a>
        </div>
      } @else if (!profile()) {
        <p class="state" role="status">Chargement du profil…</p>
      } @else {
        @let p = profile()!;
        <header class="card-head">
          <span class="avatar" aria-hidden="true">{{ p.name.charAt(0).toUpperCase() }}</span>
          <div class="who">
            <h1>{{ p.name }}</h1>
            <p>{{ p.friendCount }} ami(s) · membre depuis {{ date(p.memberSince) }}</p>
          </div>
          <div class="actions">
            @switch (p.relation) {
              @case ('self') { <a class="btn ghost" routerLink="/library" [queryParams]="{ tab: 'profile' }"><app-icon name="pencil" /> Modifier mon profil</a> }
              @case ('friend') {
                <span class="tag"><app-icon name="check" /> Ami(e)</span>
                <button type="button" class="btn primary" (click)="message()" [disabled]="busy()"><app-icon name="message" /> Écrire</button>
              }
              @case ('outgoing') { <span class="tag">Invitation envoyée</span> }
              @case ('incoming') {
                <button type="button" class="btn primary" (click)="act(social.accept(p.requestId!), 'Vous êtes maintenant amis.')" [disabled]="busy()"><app-icon name="check" /> Accepter son invitation</button>
                <button type="button" class="btn ghost" (click)="act(social.refuse(p.requestId!), 'Invitation refusée.')" [disabled]="busy()">Refuser</button>
              }
              @default {
                <button type="button" class="btn primary" (click)="act(social.invite(p.id), 'Invitation envoyée.')" [disabled]="busy()"><app-icon name="user-plus" /> Inviter</button>
              }
            }
            @if (p.relation !== 'self') {
              @if (confirmBlock()) {
                <span class="confirm" role="alertdialog" aria-label="Confirmer le blocage">
                  Bloquer {{ p.name }} ? Vous ne pourrez plus échanger, et ses accès à vos pistes seront retirés.
                  <button type="button" class="btn small danger" (click)="block()" [disabled]="busy()">Bloquer</button>
                  <button type="button" class="btn small ghost" (click)="confirmBlock.set(false)">Annuler</button>
                </span>
              } @else {
                <button type="button" class="btn ghost" (click)="confirmBlock.set(true)"><app-icon name="lock" /> Bloquer</button>
                <button type="button" class="btn ghost" (click)="reporting.set(true)"><app-icon name="flag" /> Signaler</button>
              }
            }
          </div>
        </header>
        @if (flash()) { <p class="flash" role="status"><app-icon name="check" /> {{ flash() }}</p> }
        @if (actionError()) { <p class="state error" role="alert">{{ actionError() }}</p> }

        <section aria-labelledby="tracks-title">
          <h2 id="tracks-title">Créations</h2>
          @if (!p.tracks.length) {
            <p class="state">
              @if (p.relation === 'self') { Vous n’avez encore rien rendu visible. } @else { Aucune création que vous puissiez écouter pour l’instant. }
            </p>
          } @else {
            <div class="tiles">
              @for (track of p.tracks; track track.id; let i = $index) {
                <app-track-tile [track]="track" (play)="play(i)" />
              }
            </div>
          }
        </section>
        @if (reporting()) {
          <app-report-dialog targetType="user" [targetId]="p.id" [label]="p.name" (closed)="reporting.set(false)" />
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .profile-page { display: grid; gap: 1.3rem; }
    .card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.1rem;
      padding: 1.4rem;
      border-radius: 20px;
      color: white;
      background: var(--mv-gradient);
    }
    .avatar { display: grid; width: 4.5rem; height: 4.5rem; place-items: center; border: 2px solid rgb(255 255 255 / 60%); border-radius: 50%; background: rgb(255 255 255 / 18%); font-size: 1.9rem; font-weight: 800; }
    .who { flex: 1 1 12rem; }
    .who h1 { margin: 0; color: white; }
    .who p { margin: 0.2rem 0 0; color: rgb(255 255 255 / 88%); }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.95rem; border: 1px solid transparent; border-radius: 999px; font-weight: 700; text-decoration: none; }
    .btn.primary { color: var(--mv-primary-strong); background: white; }
    .btn.ghost { color: white; border-color: rgb(255 255 255 / 60%); background: transparent; }
    .btn.danger { color: var(--mv-on-accent); background: var(--mv-danger); }
    .btn.small { padding: 0.3rem 0.7rem; font-size: 0.8rem; }
    .tag { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.75rem; border-radius: 999px; background: rgb(255 255 255 / 20%); font-weight: 700; }
    .confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; padding: 0.5rem 0.7rem; border-radius: 12px; background: rgb(0 0 0 / 22%); font-size: 0.85rem; }
    h2 { margin: 0 0 0.7rem; font-size: 1.2rem; }
    .tiles { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); }
    .state { margin: 0; padding: 0.8rem; color: var(--mv-muted); }
    .state.error { display: grid; gap: 0.5rem; color: var(--mv-danger-strong); font-weight: 600; }
    .flash { margin: 0; padding: 0.6rem 0.8rem; border-radius: 10px; background: var(--mv-primary-soft); }
    @media (max-width: 600px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class UserProfilePageComponent implements OnInit {
  readonly social = inject(SocialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly counters = inject(CountersService);
  private readonly player = inject(AudioPlayerService);

  readonly profile = signal<PublicProfile | null>(null);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly flash = signal('');
  readonly busy = signal(false);
  readonly confirmBlock = signal(false);
  readonly reporting = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.load(params.get('id') ?? ''));
  }

  private load(id: string): void {
    this.error.set('');
    this.social.profile(id).subscribe({
      next: (profile) => this.profile.set(profile),
      error: (error: unknown) => this.error.set(httpMessage(error, 'Ce profil n’existe pas ou n’est pas accessible.')),
    });
  }

  act(request: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.actionError.set('');
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.flash.set(success);
        this.counters.refresh();
        this.load(this.profile()!.id);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(httpMessage(error, 'L’action n’a pas pu être faite.'));
      },
    });
  }

  block(): void {
    this.busy.set(true);
    this.social.block(this.profile()!.id).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/friends'], { queryParams: { tab: 'blocked' } });
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(httpMessage(error, 'Le blocage n’a pas pu être fait.'));
      },
    });
  }

  message(): void {
    this.busy.set(true);
    this.social.openConversation(this.profile()!.id).subscribe({
      next: (conversation) => void this.router.navigate(['/messages', conversation.id]),
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(httpMessage(error, 'Impossible d’ouvrir la conversation.'));
      },
    });
  }

  play(index: number): void {
    const list = this.profile()!.tracks;
    if (this.player.current()?.id === list[index].id) this.player.togglePlay();
    else this.player.playList(list, index);
  }

  date(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
}
