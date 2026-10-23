import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { httpMessage, UserSummary } from '../../shared/services/library.service';
import { ReactionsService } from '../../shared/services/reactions.service';
import { AccountSettings, NotificationPref, PrivacySettings, SettingsService } from '../../shared/services/settings.service';
import { SocialService } from '../../shared/services/social.service';
import { IconComponent } from '../icon/icon';

const NOTIFICATION_LABELS: { id: NotificationPref; label: string; help: string }[] = [
  { id: 'friend_request', label: 'Invitations d’amis', help: 'Quelqu’un vous invite à devenir amis' },
  { id: 'friend_accepted', label: 'Invitations acceptées', help: 'Quelqu’un accepte votre invitation' },
  { id: 'message', label: 'Messages', help: 'Nouveaux messages dans vos conversations' },
  { id: 'track_shared', label: 'Pistes partagées', help: 'Un ami partage une piste avec vous' },
  { id: 'remix', label: 'Remixes', help: 'Demandes de remix et réponses à vos demandes' },
];

/**
 * Section 9 : paramètres du compte. Profil, mot de passe, confidentialité,
 * notifications, comptes bloqués et suppression du compte (avec explication
 * des conséquences, mot de passe et confirmation écrite).
 */
@Component({
  imports: [IconComponent, RouterLink],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly social = inject(SocialService);
  private readonly reactions = inject(ReactionsService);
  private readonly router = inject(Router);

  readonly notificationLabels = NOTIFICATION_LABELS;
  readonly settings = signal<AccountSettings | null>(null);
  readonly loadError = signal('');
  readonly saved = signal('');
  readonly saveError = signal('');

  readonly profileMessage = signal('');
  readonly profileLoadError = signal('');
  readonly blockedError = signal('');
  readonly profileError = signal('');

  readonly passwordMessage = signal('');
  readonly passwordError = signal('');

  readonly blocked = signal<{ user: UserSummary; blockedAt: string }[] | null>(null);
  readonly blockedMessage = signal('');

  readonly deletePassword = signal('');
  readonly deleteText = signal('');
  readonly deleteError = signal('');
  readonly deleting = signal(false);
  readonly deleteReady = computed(() => this.deleteText().trim() === (this.settings()?.deleteConfirmation ?? 'SUPPRIMER') && this.deletePassword().length > 0);

  ngOnInit(): void {
    if (!this.auth.currentUser()) {
      this.auth.profile().subscribe({ error: (error: unknown) => this.profileLoadError.set(httpMessage(error, 'Impossible de charger votre profil.')) });
    }
    this.settingsService.get().subscribe({
      next: (settings) => this.settings.set(settings),
      error: (error: unknown) => this.loadError.set(httpMessage(error, 'Impossible de charger vos paramètres.')),
    });
    this.loadBlocked();
  }

  /* ---------------- Profil et mot de passe ---------------- */

  saveName(name: string): void {
    this.profileMessage.set('');
    this.profileError.set('');
    if (name.trim().length < 2) {
      this.profileError.set('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    this.auth.update(name.trim()).subscribe({
      next: () => this.profileMessage.set('Nom enregistré.'),
      error: (error: unknown) => this.profileError.set(httpMessage(error, 'Le nom n’a pas pu être enregistré.')),
    });
  }

  changePassword(current: string, next: string, confirm: string, form: HTMLFormElement): void {
    this.passwordMessage.set('');
    this.passwordError.set('');
    if (next.length < 8) return this.passwordError.set('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    if (next !== confirm) return this.passwordError.set('Les deux nouveaux mots de passe ne sont pas identiques.');
    this.settingsService.changePassword(current, next).subscribe({
      next: () => {
        this.passwordMessage.set('Mot de passe changé.');
        form.reset();
      },
      error: (error: unknown) => this.passwordError.set(httpMessage(error, 'Le mot de passe n’a pas pu être changé.')),
    });
  }

  /* ---------------- Confidentialité et notifications ---------------- */

  /** Enregistre une modification immédiatement (et revient en arrière si le serveur refuse). */
  private save(changes: Parameters<SettingsService['update']>[0], label: string): void {
    const previous = this.settings();
    this.saved.set('');
    this.saveError.set('');
    if (previous) {
      this.settings.set({
        ...previous,
        privacy: { ...previous.privacy, ...changes.privacy },
        notificationPrefs: { ...previous.notificationPrefs, ...changes.notificationPrefs },
      });
    }
    this.settingsService.update(changes).subscribe({
      next: (settings) => {
        this.settings.update((current) => (current ? { ...current, ...settings } : settings));
        this.saved.set(`${label} : enregistré.`);
      },
      error: (error: unknown) => {
        this.settings.set(previous);
        this.saveError.set(httpMessage(error, 'Le paramètre n’a pas pu être enregistré.'));
      },
    });
  }

  setPrivacy<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K], label: string): void {
    this.save({ privacy: { [key]: value } }, label);
  }

  setNotification(key: NotificationPref, value: boolean, label: string): void {
    this.save({ notificationPrefs: { [key]: value } }, label);
  }

  /* ---------------- Comptes bloqués ---------------- */

  loadBlocked(): void {
    this.blockedError.set('');
    this.social.blocks().subscribe({
      next: ({ blocked }) => this.blocked.set(blocked),
      error: (error: unknown) => this.blockedError.set(httpMessage(error, 'Impossible de charger la liste des comptes bloqués.')),
    });
  }

  unblock(user: UserSummary): void {
    this.social.unblock(user.id).subscribe({
      next: () => {
        this.blocked.update((list) => list?.filter((item) => item.user.id !== user.id) ?? null);
        this.blockedMessage.set(`${user.name} est débloqué(e).`);
      },
      error: (error: unknown) => this.blockedMessage.set(httpMessage(error, 'Déblocage impossible.')),
    });
  }

  /* ---------------- Suppression du compte ---------------- */

  deleteAccount(): void {
    if (!this.deleteReady() || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    const request: Observable<void> = this.settingsService.deleteAccount(this.deletePassword(), this.deleteText().trim());
    request.subscribe({
      next: () => this.afterDeletion('Votre compte et toutes vos données ont été supprimés.'),
      error: (error: unknown) => {
        this.deleting.set(false);
        const status = (error as { status?: number }).status;
        // 500 : le compte est supprimé, seul un fichier n'a pas pu être effacé du disque.
        if (status === 500) {
          this.afterDeletion('Votre compte est supprimé. Un fichier n’a pas pu être effacé du serveur : l’administration en est informée.');
          return;
        }
        this.deleteError.set(httpMessage(error, 'La suppression a échoué.'));
      },
    });
  }

  private afterDeletion(message: string): void {
    this.auth.logout();
    this.reactions.flash.set(message);
    void this.router.navigateByUrl('/');
  }

  date(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
