import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { OnlineTrackService } from '../../shared/services/online-track.service';
import { CategoryStatsService } from '../../shared/services/category-stats.service';
import { CATEGORIES, categoryOf, displayTitle, MusicCategory } from '../../shared/models/category.model';
import { TrackVisibility } from '../../shared/models/track.model';
import { BulkImportComponent } from '../bulk-import/bulk-import';
import { IconComponent } from '../icon/icon';
import { TrackService } from '../../shared/services/track.service';
import { OnlineTrackAddComponent } from '../online-track-add/online-track-add';
import { ShareDialogComponent } from '../share-dialog/share-dialog';
import { measureDuration } from '../../shared/audio/duration';
import { AUDIO_ACCEPT, AUDIO_FORMATS_LABEL, isAcceptedAudio, isMpegVariant, prepareAudioFile } from '../../shared/audio/audio-formats';
import { SettingsService } from '../../shared/services/settings.service';
import { httpMessage } from '../../shared/services/library.service';
import { AuthService } from '../../shared/services/auth.service';

const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  imports: [DatePipe, ReactiveFormsModule, OnlineTrackAddComponent, BulkImportComponent, IconComponent, ShareDialogComponent],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  private readonly online = inject(OnlineTrackService);
  readonly stats = inject(CategoryStatsService);
  readonly categories = CATEGORIES;
  readonly categoryOf = categoryOf;
  readonly displayTitle = displayTitle;
  /** Catégorie sélectionnée dans la grille (chaîne vide = toutes). */
  readonly categoryFilter = signal('');
  readonly uploadCategory = new FormControl('autres', { nonNullable: true });
  /** Privé par défaut (règle MOST VIBE). « Amis choisis » ouvre la fenêtre de partage après l'envoi. */
  readonly uploadVisibility = new FormControl<TrackVisibility>('private', { nonNullable: true });
  /** Piste dont la fenêtre « Visibilité et partage » est ouverte. */
  readonly sharing = signal<Track | null>(null);
  private readonly settingsService = inject(SettingsService);
  private readonly auth = inject(AuthService);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly uploading = signal(false);
  readonly uploadProgress = signal<number | null>(null);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  readonly audioUrl = signal('');
  readonly coverUrls = signal<Record<string, string>>({});
  readonly coverErrors = signal<Record<string, string>>({});
  readonly playingTrackId = signal('');
  readonly audioLoadingTrackId = signal('');
  readonly audioErrorTrackId = signal('');
  readonly audioError = signal('');
  readonly deletingTrackId = signal('');
  readonly deleteErrorTrackId = signal('');
  readonly deleteError = signal('');
  readonly deleteSuccess = signal('');
  readonly titleFilter = signal('');
  readonly title = new FormControl('', { nonNullable: true });
  /** Une seule liste : les morceaux ajoutés depuis internet en tête de la première page, puis ceux du serveur. */
  readonly displayedTracks = computed(() => {
    const category = this.categoryFilter();
    const inCategory = (track: Track) => !category || categoryOf(track).id === category;
    const online = this.page() === 1 ? this.online.filtered(this.titleFilter()).filter(inCategory) : [];
    // Catégorie + texte : le backend filtre sur le texte, la catégorie est vérifiée ici.
    return [...online, ...this.tracks().filter(inCategory)];
  });
  private fileInput?: HTMLInputElement;
  private coverInput?: HTMLInputElement;
  private filterTimer?: ReturnType<typeof setTimeout>;
  private coverLoadVersion = 0;
  private destroyed = false;
  file?: File;
  coverFile?: File;
  /** Durée du fichier choisi, en secondes (mesurée par le navigateur). */
  private fileDuration?: number;
  /** Vérification d'un fichier MPEG en cours. */
  readonly checkingFile = signal(false);
  readonly audioAccept = AUDIO_ACCEPT;

  constructor() {
    this.load();
    this.stats.refresh();
    // Section 9 : la visibilité proposée à l'envoi est celle choisie dans les paramètres.
    if (this.auth.token()) {
      this.settingsService.get().subscribe({
        next: (settings) => {
          if (!this.uploading()) this.uploadVisibility.setValue(settings.privacy.defaultVisibility);
        },
        error: () => undefined,
      });
    }
  }

  ngOnDestroy(): void {
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.destroyed = true;
    this.coverLoadVersion++;
    const audioUrl = this.audioUrl();
    if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
    this.revokeCoverUrls();
  }

  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileInput = input;
    const file = input.files?.[0];
    this.uploadError.set('');
    this.uploadSuccess.set('');

    if (!file) {
      this.file = undefined;
      return;
    }

    if (!isAcceptedAudio(file)) {
      this.file = undefined;
      input.value = '';
      this.uploadError.set(`Format audio non accepté. Choisissez un fichier ${AUDIO_FORMATS_LABEL}.`);
      return;
    }

    if (file.size > MAX_AUDIO_FILE_SIZE) {
      this.file = undefined;
      input.value = '';
      this.uploadError.set('Le fichier dépasse la taille maximale autorisée de 25 Mo.');
      return;
    }

    // Fichier MPEG (.mpeg, .mpg…) : on vérifie d'abord que le navigateur sait en lire le son.
    if (isMpegVariant(file)) {
      this.file = undefined;
      this.checkingFile.set(true);
      void prepareAudioFile(file).then(
        (ready) => {
          this.checkingFile.set(false);
          if (input.files?.[0] !== file) return;
          this.useFile(ready);
        },
        (error: Error) => {
          this.checkingFile.set(false);
          input.value = '';
          this.uploadError.set(error.message);
        },
      );
      return;
    }
    this.useFile(file);
  }

  /** Fichier audio prêt à être envoyé. */
  private useFile(file: File): void {
    this.file = file;
    console.debug('[TracksPage] Fichier sélectionné', this.file?.name);
    // Durée mesurée en arrière-plan dès le choix du fichier ; envoyée avec la piste si elle est prête.
    this.fileDuration = undefined;
    void measureDuration(file).then((seconds) => {
      if (this.file === file && seconds) this.fileDuration = seconds;
    });
  }

  chooseCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.coverInput = input;
    const file = input.files?.[0];
    this.uploadError.set('');
    this.uploadSuccess.set('');

    if (!file) {
      this.coverFile = undefined;
      return;
    }

    if (!ALLOWED_COVER_TYPES.has(file.type)) {
      this.coverFile = undefined;
      input.value = '';
      this.uploadError.set('Format de couverture non accepté. Choisissez une image JPEG, PNG ou WebP.');
      return;
    }

    if (file.size > MAX_COVER_FILE_SIZE) {
      this.coverFile = undefined;
      input.value = '';
      this.uploadError.set('La couverture dépasse la taille maximale autorisée de 5 Mo.');
      return;
    }

    this.coverFile = file;
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.list(this.page(), 5, this.titleFilter().trim(), this.categoryFilter()).subscribe({
      next: (response) => {
        const docs = 'docs' in response ? response.docs : response.items;
        const totalPages = 'totalPages' in response ? response.totalPages : response.pages;

        if (!Array.isArray(docs)) {
          console.error('[TracksPage] Format de réponse API inattendu', response);
          this.error.set('Réponse API incompatible. Redémarrez le backend puis actualisez la page.');
          this.tracks.set([]);
          this.pages.set(1);
          this.loading.set(false);
          return;
        }

        console.debug('[TracksPage] Pistes chargées', docs.length);
        this.tracks.set(docs);
        this.loadCovers(docs);
        this.pages.set(Math.max(1, totalPages));
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Chargement impossible', error);
        if (error.status === 401) {
          this.error.set('Votre session a expiré ou vous n’êtes pas connecté. Reconnectez-vous pour afficher vos pistes.');
        } else if (error.status === 0) {
          this.error.set('Impossible de joindre l’API. Vérifiez que le backend est démarré et que le proxy Angular est actif.');
        } else {
          const apiMessage =
            typeof error.error === 'object' &&
            error.error !== null &&
            'message' in error.error &&
            typeof error.error.message === 'string'
              ? error.error.message
              : '';
          this.error.set(apiMessage || httpMessage(error, 'Le chargement des pistes a échoué. Réessayez avec « Actualiser ».'));
        }
        this.loading.set(false);
      },
    });
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  selectCategory(id: string): void {
    this.categoryFilter.set(this.categoryFilter() === id ? '' : id);
    this.page.set(1);
    this.load();
  }

  categoryCount(category: MusicCategory): number | null {
    const server = this.stats.counts()[category.id];
    const online = this.online.tracks().filter((track) => categoryOf(track).id === category.id).length;
    return server === undefined ? null : server + online;
  }

  totalCount(): number | null {
    const total = this.stats.total();
    return total === null ? null : total + this.online.tracks().length;
  }

  onImported(): void {
    this.page.set(1);
    this.load();
    this.stats.refresh();
  }

  filterByTitle(event: Event): void {
    this.titleFilter.set((event.target as HTMLInputElement).value);
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 250);
  }

  onlineAdded(): void {
    this.page.set(1);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;

    const units = ['Ko', 'Mo', 'Go'];
    let size = bytes / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(size)} ${units[unitIndex]}`;
  }

  upload(): void {
    if (this.uploading()) return;

    this.uploadError.set('');
    this.uploadSuccess.set('');
    if (!this.file) {
      this.uploadError.set('Choisissez un fichier audio avant de l’envoyer.');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(null);
    const title = this.title.value || this.file.name;
    this.service.upload(this.file, title, this.coverFile, { style: this.uploadCategory.value, visibility: this.uploadVisibility.value, durationSeconds: this.fileDuration }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress.set(
            event.total ? Math.round((event.loaded / event.total) * 100) : null,
          );
          return;
        }
        if (event.type !== HttpEventType.Response) return;
        if (!event.body) {
          this.uploading.set(false);
          this.uploadProgress.set(null);
          this.uploadError.set('Le serveur a terminé l’envoi sans retourner la piste créée.');
          return;
        }

        const track = event.body;
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.uploading.set(false);
        this.uploadProgress.set(100);
        this.title.setValue('');
        this.file = undefined;
        if (this.fileInput) this.fileInput.value = '';
        this.coverFile = undefined;
        if (this.coverInput) this.coverInput.value = '';
        this.uploadError.set('');
        if (track.visibility === 'friends') {
          // Section 5 : on choisit tout de suite les personnes qui pourront écouter.
          this.uploadSuccess.set('Piste ajoutée. Choisissez maintenant les personnes qui pourront l’écouter.');
          this.sharing.set(track);
        } else {
          this.uploadSuccess.set('Piste ajoutée avec succès.');
        }
        this.stats.refresh();
        this.page.set(1);
        this.load();
      },
      error: (error) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.uploadProgress.set(null);
        const message =
          typeof error.error === 'object' &&
          error.error !== null &&
          'message' in error.error &&
          typeof error.error.message === 'string'
            ? error.error.message
            : '';
        this.uploadError.set(message || 'L’envoi du fichier a échoué. Réessayez.');
      },
    });
  }

  /** Met à jour le badge de visibilité après un changement dans la fenêtre de partage. */
  shareChanged(updated: Track): void {
    this.tracks.update((list) => list.map((track) => (track.id === updated.id ? { ...track, visibility: updated.visibility } : track)));
  }

  deleteTrack(track: Track): void {
    if (this.deletingTrackId()) return;
    if (track.online) {
      // Morceau en ligne : on retire seulement la référence, le fichier reste chez sa source.
      if (!window.confirm(`Retirer « ${track.title} » de votre liste ? Le fichier reste disponible chez ${track.online.sourceLabel}.`)) return;
      this.deleteErrorTrackId.set('');
      this.deleteError.set('');
      this.online.remove(track.id).then(
        () => {
          if (this.playingTrackId() === track.id) {
            this.audioUrl.set('');
            this.playingTrackId.set('');
          }
          this.deleteSuccess.set(`« ${displayTitle(track)} » a été retiré de votre liste.`);
        },
        (error: unknown) => {
          console.error('[TracksPage] Retrait du morceau en ligne impossible', error);
          this.deleteErrorTrackId.set(track.id);
          this.deleteError.set('Le retrait a échoué. Réessayez.');
        },
      );
      return;
    }
    if (!window.confirm(`Voulez-vous vraiment supprimer « ${track.title} » ? Cette action est définitive.`)) {
      return;
    }

    this.deleteErrorTrackId.set('');
    this.deleteError.set('');
    this.deleteSuccess.set('');
    this.deletingTrackId.set(track.id);
    this.service.delete(track.id).subscribe({
      next: () => {
        this.deletingTrackId.set('');
        this.deleteSuccess.set(`« ${displayTitle(track)} » a été supprimé.`);
        this.stats.refresh();
        this.revokeCoverUrl(track.id);
        if (this.playingTrackId() === track.id) {
          const audioUrl = this.audioUrl();
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          this.audioUrl.set('');
          this.playingTrackId.set('');
        }
        this.page.set(1);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Suppression impossible', error);
        this.deletingTrackId.set('');
        const message =
          typeof error.error === 'object' &&
          error.error !== null &&
          'message' in error.error &&
          typeof error.error.message === 'string'
            ? error.error.message
            : '';
        this.deleteErrorTrackId.set(track.id);
        this.deleteError.set(message || 'La suppression a échoué. Réessayez.');
      },
    });
  }

  play(track: Track): void {
    if (track.online) {
      // Simple écoute : la balise <audio> lit le fichier directement chez sa source.
      const previousUrl = this.audioUrl();
      if (previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
      this.audioErrorTrackId.set('');
      this.audioUrl.set(track.online.audioUrl);
      this.playingTrackId.set(track.id);
      return;
    }
    this.audioLoadingTrackId.set(track.id);
    this.audioErrorTrackId.set('');
    this.audioError.set('');
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
        this.playingTrackId.set(track.id);
        this.audioLoadingTrackId.set('');
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Lecture impossible', error);
        this.audioLoadingTrackId.set('');
        this.audioErrorTrackId.set(track.id);
        const message =
          typeof error.error === 'object' &&
          error.error !== null &&
          'message' in error.error &&
          typeof error.error.message === 'string'
            ? error.error.message
            : '';
        this.audioError.set(message || 'Impossible de charger ce morceau. Réessayez.');
      },
    });
  }

  private loadCovers(tracks: Track[]): void {
    const version = ++this.coverLoadVersion;
    this.revokeCoverUrls();
    this.coverErrors.set({});

    for (const track of tracks) {
      if (!track.coverUrl) continue;

      this.service.cover(track.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          if (this.destroyed || version !== this.coverLoadVersion) {
            URL.revokeObjectURL(url);
            return;
          }
          this.coverUrls.update((urls) => ({ ...urls, [track.id]: url }));
        },
        error: (error: HttpErrorResponse) => {
          console.error(`[TracksPage] Couverture impossible à charger : ${track.id}`, error);
          if (this.destroyed || version !== this.coverLoadVersion) return;
          this.coverErrors.update((errors) => ({
            ...errors,
            [track.id]: 'La couverture n’a pas pu être chargée.',
          }));
        },
      });
    }
  }

  private revokeCoverUrl(trackId: string): void {
    const url = this.coverUrls()[trackId];
    if (url) URL.revokeObjectURL(url);
    this.coverUrls.update(({ [trackId]: _removed, ...urls }) => urls);
  }

  private revokeCoverUrls(): void {
    for (const url of Object.values(this.coverUrls())) URL.revokeObjectURL(url);
    this.coverUrls.set({});
  }
}
