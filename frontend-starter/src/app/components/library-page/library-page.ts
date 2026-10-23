import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { categoryOf, displayTitle } from '../../shared/models/category.model';
import { Track, TrackVisibility } from '../../shared/models/track.model';
import { IconName } from '../../shared/icons/icons';
import { AudioPlayerService } from '../../shared/services/audio-player.service';
import { AuthService } from '../../shared/services/auth.service';
import { Album, httpMessage, LibraryService, Playlist, PlaylistDetail, SharedTrack } from '../../shared/services/library.service';
import { PublicService } from '../../shared/services/public.service';
import { ReactionsService } from '../../shared/services/reactions.service';
import { MixProjectSummary, MixService, RemixRequest } from '../../shared/services/mix.service';
import { TrackService } from '../../shared/services/track.service';
import { CoverImageComponent } from '../cover-image/cover-image';
import { IconComponent } from '../icon/icon';
import { ShareDialogComponent } from '../share-dialog/share-dialog';
import { TrackTileComponent } from '../track-tile/track-tile';

type Tab = 'files' | 'albums' | 'playlists' | 'favorites' | 'shared' | 'mixes' | 'profile';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'files', label: 'Mes fichiers', icon: 'file-audio' },
  { id: 'albums', label: 'Albums', icon: 'album' },
  { id: 'playlists', label: 'Playlists', icon: 'list-music' },
  { id: 'favorites', label: 'Favoris', icon: 'star' },
  { id: 'shared', label: 'Partagés avec moi', icon: 'users' },
  { id: 'mixes', label: 'Projets de mixage', icon: 'sliders' },
  { id: 'profile', label: 'Profil', icon: 'user' },
];

export const VISIBILITY_LABELS: Record<TrackVisibility, { label: string; icon: IconName }> = {
  private: { label: 'Privé', icon: 'lock' },
  friends: { label: 'Amis choisis', icon: 'users' },
  public: { label: 'Public', icon: 'globe' },
};

const FILES_PER_PAGE = 10;

/**
 * « Ma bibliothèque » (section 4) : espace personnel avec mes fichiers (et leur
 * visibilité, section 5), mes albums, playlists, favoris, les pistes partagées
 * avec moi, les projets de mixage et mon profil. Tout vient de la base.
 */
@Component({
  imports: [RouterLink, IconComponent, TrackTileComponent, ShareDialogComponent, CoverImageComponent],
  templateUrl: './library-page.html',
  styleUrl: './library-page.css',
})
export class LibraryPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly library = inject(LibraryService);
  private readonly trackService = inject(TrackService);
  private readonly publicService = inject(PublicService);
  private readonly mixes = inject(MixService);
  readonly auth = inject(AuthService);
  readonly player = inject(AudioPlayerService);
  readonly reactions = inject(ReactionsService);

  readonly tabs = TABS;
  readonly visibilityLabels = VISIBILITY_LABELS;
  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  readonly tab = signal<Tab>('files');

  // Mes fichiers
  readonly files = signal<Track[]>([]);
  readonly filesPage = signal(1);
  readonly filesTotalPages = signal(1);
  /** null tant que la liste n'a pas été chargée (pas de « 0 » trompeur en cas d'erreur). */
  readonly filesTotal = signal<number | null>(null);
  readonly filesSearch = signal('');
  readonly filesLoading = signal(false);
  readonly filesError = signal('');
  readonly sharing = signal<Track | null>(null);

  // Albums
  readonly albums = signal<Album[] | null>(null);
  readonly albumsError = signal('');
  readonly openAlbum = signal<{ album: Album; tracks: Track[] } | null>(null);

  // Playlists
  readonly playlists = signal<Playlist[] | null>(null);
  readonly playlistsError = signal('');
  readonly playlistMessage = signal('');
  readonly openPlaylist = signal<PlaylistDetail | null>(null);
  readonly confirmDeletePlaylist = signal('');

  // Favoris et partages
  readonly favorites = signal<Track[] | null>(null);
  readonly favoritesError = signal('');
  readonly shared = signal<SharedTrack[] | null>(null);
  readonly sharedError = signal('');

  // Projets de mixage et demandes de remix (section 8)
  readonly projects = signal<MixProjectSummary[] | null>(null);
  readonly projectsError = signal('');
  readonly incoming = signal<RemixRequest[] | null>(null);
  readonly outgoing = signal<RemixRequest[] | null>(null);
  readonly confirmDeleteProject = signal('');
  readonly mixMessage = signal('');

  // Profil
  readonly profileMessage = signal('');
  readonly profileError = signal('');

  readonly counts = computed(() => ({
    files: this.filesTotal(),
    albums: this.albums()?.length,
    playlists: this.playlists()?.length,
    favorites: this.reactions.loaded() ? this.reactions.favorites().size : undefined,
    shared: this.shared()?.length,
  }));

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const requested = params.get('tab') as Tab | null;
      const tab = TABS.some((item) => item.id === requested) ? requested! : 'files';
      this.tab.set(tab);
      this.loadTab(tab);
    });
    if (!this.auth.currentUser()) this.auth.profile().subscribe({ error: () => undefined });
  }

  selectTab(tab: Tab): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'files' ? null : tab }, queryParamsHandling: 'merge' });
  }

  private loadTab(tab: Tab): void {
    if (tab === 'files') this.loadFiles();
    if (tab === 'albums') this.loadAlbums();
    if (tab === 'playlists') this.loadPlaylists();
    if (tab === 'favorites') this.loadFavorites();
    if (tab === 'shared') this.loadShared();
    if (tab === 'mixes') this.loadMixes();
  }

  /* ---------------- Mes fichiers ---------------- */

  loadFiles(page = this.filesPage()): void {
    this.filesLoading.set(true);
    this.filesError.set('');
    this.trackService.list(page, FILES_PER_PAGE, this.filesSearch()).subscribe({
      next: (result) => {
        const docs = 'docs' in result ? result.docs : result.items;
        this.files.set(docs);
        this.filesPage.set(result.page ?? page);
        this.filesTotalPages.set(Math.max(1, 'docs' in result ? result.totalPages : result.pages));
        this.filesTotal.set('docs' in result ? result.totalDocs : result.total);
        this.filesLoading.set(false);
      },
      error: (error: unknown) => {
        this.filesLoading.set(false);
        this.filesError.set(httpMessage(error, 'Impossible de charger vos fichiers.'));
      },
    });
  }

  searchFiles(text: string): void {
    this.filesSearch.set(text.trim());
    this.loadFiles(1);
  }

  isCurrent(track: Track): boolean {
    return this.player.current()?.id === track.id;
  }

  playFile(list: Track[], index: number): void {
    const track = list[index];
    if (this.isCurrent(track)) this.player.togglePlay();
    else this.player.playList(list, index);
  }

  shareChanged(updated: Track): void {
    this.files.update((list) => list.map((track) => (track.id === updated.id ? { ...track, visibility: updated.visibility } : track)));
    this.sharing.update((track) => (track ? { ...track, visibility: updated.visibility } : track));
  }

  /* ---------------- Albums ---------------- */

  loadAlbums(): void {
    this.albumsError.set('');
    this.library.albums().subscribe({
      next: ({ albums }) => this.albums.set(albums),
      error: (error: unknown) => this.albumsError.set(httpMessage(error, 'Impossible de charger vos albums.')),
    });
  }

  showAlbum(album: Album): void {
    this.openAlbum.set({ album, tracks: [] });
    forkJoin(album.trackIds.map((id) => this.publicService.track(id).pipe(catchError(() => of(null))))).subscribe((tracks) =>
      this.openAlbum.set({ album, tracks: tracks.filter((track): track is Track => !!track) }),
    );
  }

  /* ---------------- Playlists ---------------- */

  loadPlaylists(): void {
    this.playlistsError.set('');
    this.library.playlists().subscribe({
      next: ({ playlists }) => this.playlists.set(playlists),
      error: (error: unknown) => this.playlistsError.set(httpMessage(error, 'Impossible de charger vos playlists.')),
    });
  }

  createPlaylist(name: string, visibility: string): void {
    this.playlistMessage.set('');
    if (!name.trim()) {
      this.playlistMessage.set('Donnez un nom à la playlist.');
      return;
    }
    this.library.createPlaylist({ name: name.trim(), visibility: visibility === 'public' ? 'public' : 'private' }).subscribe({
      next: (playlist) => {
        this.playlists.update((list) => [playlist, ...(list ?? [])]);
        this.playlistMessage.set(`Playlist « ${playlist.name} » créée. Ajoutez-y des pistes avec le bouton « Ajouter à une playlist ».`);
      },
      error: (error: unknown) => this.playlistMessage.set(httpMessage(error, 'Création impossible.')),
    });
  }

  showPlaylist(playlist: Playlist): void {
    this.library.playlist(playlist.id).subscribe({
      next: (detail) => this.openPlaylist.set(detail),
      error: (error: unknown) => this.playlistMessage.set(httpMessage(error, 'Impossible d’ouvrir la playlist.')),
    });
  }

  togglePlaylistVisibility(playlist: Playlist): void {
    const visibility = playlist.visibility === 'public' ? 'private' : 'public';
    this.library.updatePlaylist(playlist.id, { visibility }).subscribe({
      next: (updated) => {
        this.playlists.update((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
        this.openPlaylist.update((detail) => (detail?.id === updated.id ? { ...detail, ...updated } : detail));
      },
      error: (error: unknown) => this.playlistMessage.set(httpMessage(error, 'Modification impossible.')),
    });
  }

  deletePlaylist(playlist: Playlist): void {
    this.confirmDeletePlaylist.set('');
    this.library.deletePlaylist(playlist.id).subscribe({
      next: () => {
        this.playlists.update((list) => list?.filter((item) => item.id !== playlist.id) ?? null);
        if (this.openPlaylist()?.id === playlist.id) this.openPlaylist.set(null);
        this.playlistMessage.set(`Playlist « ${playlist.name} » supprimée (les pistes, elles, ne sont pas supprimées).`);
      },
      error: (error: unknown) => this.playlistMessage.set(httpMessage(error, 'Suppression impossible.')),
    });
  }

  removeFromPlaylist(detail: PlaylistDetail, track: Track): void {
    this.library.removeFromPlaylist(detail.id, track.id).subscribe({
      next: (updated) => {
        this.openPlaylist.set({ ...detail, ...updated, tracks: detail.tracks.filter((item) => item.id !== track.id) });
        this.playlists.update((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      },
      error: (error: unknown) => this.playlistMessage.set(httpMessage(error, 'Retrait impossible.')),
    });
  }

  /* ---------------- Favoris / partages ---------------- */

  loadFavorites(): void {
    this.favoritesError.set('');
    this.library.favorites().subscribe({
      next: ({ docs }) => this.favorites.set(docs),
      error: (error: unknown) => this.favoritesError.set(httpMessage(error, 'Impossible de charger vos favoris.')),
    });
  }

  loadShared(): void {
    this.sharedError.set('');
    this.library.shared().subscribe({
      next: ({ docs }) => this.shared.set(docs),
      error: (error: unknown) => this.sharedError.set(httpMessage(error, 'Impossible de charger les pistes partagées.')),
    });
  }

  /* ---------------- Projets de mixage ---------------- */

  loadMixes(): void {
    this.projectsError.set('');
    this.mixes.list().subscribe({
      next: ({ projects }) => this.projects.set(projects),
      error: (error: unknown) => this.projectsError.set(httpMessage(error, 'Impossible de charger vos projets.')),
    });
    this.mixes.requests('incoming').subscribe({ next: ({ requests }) => this.incoming.set(requests), error: () => this.incoming.set([]) });
    this.mixes.requests('outgoing').subscribe({ next: ({ requests }) => this.outgoing.set(requests), error: () => this.outgoing.set([]) });
  }

  decksLabel(project: MixProjectSummary): string {
    return project.decks.length ? project.decks.map((deck) => `${deck.deck} : ${deck.title}`).join(' · ') : 'Platines vides';
  }

  requestBadge(status: RemixRequest['status']): string {
    return status === 'accepted' ? 'badge vis-public' : status === 'refused' ? 'badge vis-private' : 'badge vis-friends';
  }

  requestLabel(status: RemixRequest['status']): string {
    return status === 'accepted' ? 'Acceptée' : status === 'refused' ? 'Refusée' : 'En attente';
  }

  deleteProject(id: string): void {
    this.confirmDeleteProject.set('');
    this.mixes.remove(id).subscribe({
      next: () => {
        this.projects.update((list) => list?.filter((project) => project.id !== id) ?? null);
        this.mixMessage.set('Projet supprimé (les mixages déjà publiés restent en ligne).');
      },
      error: (error: unknown) => this.mixMessage.set(httpMessage(error, 'Suppression impossible.')),
    });
  }

  answer(requestId: string, accept: boolean): void {
    this.mixes.answer(requestId, accept).subscribe({
      next: (updated) => {
        this.incoming.update((list) => list?.map((request) => (request.id === updated.id ? updated : request)) ?? null);
        this.mixMessage.set(accept ? `${updated.requester.name} peut maintenant publier un remix de « ${updated.track.title} ».` : `Demande de ${updated.requester.name} refusée.`);
      },
      error: (error: unknown) => this.mixMessage.set(httpMessage(error, 'La réponse n’a pas pu être enregistrée.')),
    });
  }

  cancelRequest(requestId: string): void {
    this.mixes.cancelRequest(requestId).subscribe({
      next: () => this.outgoing.update((list) => list?.filter((request) => request.id !== requestId) ?? null),
      error: (error: unknown) => this.mixMessage.set(httpMessage(error, 'Annulation impossible.')),
    });
  }

  /* ---------------- Profil ---------------- */

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

  date(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
