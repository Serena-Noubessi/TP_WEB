import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconName } from '../../shared/icons/icons';
import { AuthService } from '../../shared/services/auth.service';
import { ReactionsService } from '../../shared/services/reactions.service';
import { IconComponent } from '../icon/icon';
import { PlayerBarComponent } from '../player-bar/player-bar';
import { NotificationBellComponent } from '../notification-bell/notification-bell';
import { CountersService } from '../../shared/services/counters.service';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Visible uniquement une fois connecté. */
  auth?: boolean;
  /** Visible uniquement pour un administrateur (le serveur revérifie à chaque requête). */
  admin?: boolean;
  /** Présent dans la barre du bas sur mobile (les autres sont dans « Plus »). */
  mobile?: boolean;
}

/**
 * Cadre de MOST VIBE : menu vertical sur ordinateur, barre de navigation sur mobile,
 * lecteur audio persistant en bas de l'écran (il continue de jouer d'une page à l'autre).
 */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent, PlayerBarComponent, NotificationBellComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  /** Messages courts après une action (favori ajouté, action faite après connexion…). */
  readonly reactions = inject(ReactionsService);
  private flashTimer?: ReturnType<typeof setTimeout>;
  /** Pastilles du menu : invitations reçues (Amis) et messages non lus (Messages). */
  private readonly counters = inject(CountersService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  readonly darkMode = signal(localStorage.getItem('gpc_theme') === 'dark');
  readonly moreOpen = signal(false);

  /** Sections de la mission MOST VIBE, puis les onglets existants conservés (Backing tracks, Audio, Mixage). */
  readonly nav: NavItem[] = [
    { path: '/', label: 'Accueil', icon: 'home', mobile: true },
    { path: '/explore', label: 'Explorer', icon: 'compass', mobile: true },
    { path: '/library', label: 'Ma bibliothèque', icon: 'library', auth: true, mobile: true },
    { path: '/tracks', label: 'Backing tracks', icon: 'list-music', auth: true },
    { path: '/audio', label: 'Audio', icon: 'audio-lines', auth: true },
    // Sur mobile, Mixage est dans « Plus » : la barre du bas garde Messages (pastille des non-lus visible).
    { path: '/mix', label: 'Mixage', icon: 'sliders', auth: true },
    { path: '/friends', label: 'Amis', icon: 'users', auth: true },
    { path: '/messages', label: 'Messages', icon: 'message', auth: true, mobile: true },
    { path: '/settings', label: 'Paramètres', icon: 'settings', auth: true },
    { path: '/admin', label: 'Administration', icon: 'shield', auth: true, admin: true },
  ];

  constructor() {
    effect(() => {
      this.document.body.classList.toggle('dark-mode', this.darkMode());
    });
    // Profil (nom, rôle) chargé au démarrage quand une session existe déjà.
    effect(() => {
      if (this.auth.token() && !this.auth.currentUser()) this.auth.profile().subscribe({ error: () => undefined });
    });
    effect(() => {
      if (!this.reactions.flash()) return;
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => this.reactions.flash.set(''), 3500);
    });
  }

  badge(path: string): number {
    if (path === '/friends') return this.counters.counters().invitations;
    if (path === '/messages') return this.counters.counters().messages;
    return 0;
  }

  visibleItems(): NavItem[] {
    return this.nav.filter((item) => (!item.auth || this.auth.token()) && (!item.admin || this.auth.isAdmin()));
  }

  mobileItems(): NavItem[] {
    return this.visibleItems().filter((item) => item.mobile).slice(0, 4);
  }

  /** Pastille du bouton « Plus » : total des pastilles des pages qu'il contient. */
  moreBadge(): number {
    return this.moreItems().reduce((total, item) => total + this.badge(item.path), 0);
  }

  moreItems(): NavItem[] {
    const mobile = new Set(this.mobileItems());
    return this.visibleItems().filter((item) => !mobile.has(item));
  }

  logout(): void {
    this.auth.logout();
    this.moreOpen.set(false);
    void this.router.navigateByUrl('/');
  }

  toggleTheme(): void {
    const enabled = !this.darkMode();
    this.darkMode.set(enabled);
    localStorage.setItem('gpc_theme', enabled ? 'dark' : 'light');
  }
}
