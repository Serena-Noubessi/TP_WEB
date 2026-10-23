import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { LoginPageComponent } from './components/login-page/login-page';
import { ProfilePageComponent } from './components/profile-page/profile-page';
import { RegisterPageComponent } from './components/register-page/register-page';
import { TracksPageComponent } from './components/tracks-page/tracks-page';
import { HomePageComponent } from './components/home-page/home-page';


export const routes: Routes = [
  // MOST VIBE : accueil et exploration accessibles sans compte.
  { path: '', pathMatch: 'full', component: HomePageComponent, title: 'MOST VIBE' },
  { path: 'explore', loadComponent: () => import('./components/explore-page/explore-page').then((m) => m.ExplorePageComponent), title: 'Explorer — MOST VIBE' },
  { path: 'login', component: LoginPageComponent, title: 'Connexion — MOST VIBE' },
  { path: 'register', component: RegisterPageComponent, title: 'Inscription — MOST VIBE' },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard], title: 'Mon profil — MOST VIBE' },
  // Onglets existants conservés.
  { path: 'tracks', component: TracksPageComponent, canActivate: [authGuard], title: 'Backing tracks — MOST VIBE' },
  {
    path: 'audio',
    loadComponent: () => import('./components/audio-page/audio-page').then((m) => m.AudioPageComponent),
    canActivate: [authGuard],
    title: 'Audio — MOST VIBE',
  },
  {
    path: 'mix',
    loadComponent: () => import('./components/mix-page/mix-page').then((m) => m.MixPageComponent),
    canActivate: [authGuard],
    title: 'Mixage — MOST VIBE',
  },
  {
    path: 'library',
    loadComponent: () => import('./components/library-page/library-page').then((m) => m.LibraryPageComponent),
    canActivate: [authGuard],
    title: 'Ma bibliothèque — MOST VIBE',
  },
  // MOST VIBE étape 3 : amis, profils publics et messagerie.
  {
    path: 'friends',
    loadComponent: () => import('./components/friends-page/friends-page').then((m) => m.FriendsPageComponent),
    canActivate: [authGuard],
    title: 'Amis — MOST VIBE',
  },
  {
    path: 'u/:id',
    loadComponent: () => import('./components/user-profile-page/user-profile-page').then((m) => m.UserProfilePageComponent),
    canActivate: [authGuard],
    title: 'Profil — MOST VIBE',
  },
  {
    path: 'messages',
    loadComponent: () => import('./components/messages-page/messages-page').then((m) => m.MessagesPageComponent),
    canActivate: [authGuard],
    title: 'Messages — MOST VIBE',
  },
  {
    path: 'messages/:id',
    loadComponent: () => import('./components/messages-page/messages-page').then((m) => m.MessagesPageComponent),
    canActivate: [authGuard],
    title: 'Messages — MOST VIBE',
  },
  // MOST VIBE étape 4 : paramètres (section 9) et administration (section 10, rôle vérifié par le serveur).
  {
    path: 'settings',
    loadComponent: () => import('./components/settings-page/settings-page').then((m) => m.SettingsPageComponent),
    canActivate: [authGuard],
    title: 'Paramètres — MOST VIBE',
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin-page/admin-page').then((m) => m.AdminPageComponent),
    canActivate: [authGuard],
    title: 'Administration — MOST VIBE',
  },
  { path: '**', redirectTo: '' },
];
