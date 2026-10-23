import { Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogError, CatalogTrack, MusicCatalog } from '../../shared/catalogs/music-catalog';
import { OnlineAudioError } from '../../shared/audio/online-audio-error';
import { DownloadProgress } from '../../shared/audio/remote-audio';
import { Track } from '../../shared/models/track.model';
import { CATEGORIES } from '../../shared/models/category.model';
import { CatalogKeysService } from '../../shared/services/catalog-keys.service';
import { CatalogService } from '../../shared/services/catalog.service';
import { OnlineTrackService } from '../../shared/services/online-track.service';
import { IconComponent } from '../icon/icon';

/** En dessous de ce débit après quelques secondes, l'utilisateur est prévenu que la connexion est lente. */
const SLOW_BYTES_PER_SECOND = 64 * 1024;

export const LICENSE_CHOICES = [
  'Licence non précisée',
  'CC0 (domaine public)',
  'CC BY',
  'CC BY-SA',
  'CC BY-NC',
  'CC BY-NC-SA',
  'CC BY-ND',
  'CC BY-NC-ND',
  'Droits accordés par l’auteur',
];

/** Ajout de morceaux depuis internet : lien direct vers un fichier ou recherche dans un catalogue libre. */
@Component({
  selector: 'app-online-track-add',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './online-track-add.html',
  styleUrl: './online-track-add.css',
})
export class OnlineTrackAddComponent {
  private readonly online = inject(OnlineTrackService);
  readonly catalogService = inject(CatalogService);
  readonly keys = inject(CatalogKeysService);

  readonly added = output<Track>();

  readonly mode = signal<'url' | 'catalog'>('url');
  readonly licenses = LICENSE_CHOICES;
  readonly categories = CATEGORIES;
  /** Catégorie donnée aux morceaux ajoutés (lien direct ou catalogue). */
  readonly category = new FormControl('autres', { nonNullable: true });

  // Téléchargement en cours (commun aux deux modes : un seul à la fois).
  readonly busyLabel = signal('');
  readonly progress = signal<DownloadProgress | null>(null);
  readonly slow = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly percent = computed(() => {
    const progress = this.progress();
    return progress?.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null;
  });
  private controller?: AbortController;
  private startedAt = 0;

  readonly urlForm = new FormGroup({
    url: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', { nonNullable: true }),
    artist: new FormControl('', { nonNullable: true }),
    license: new FormControl(LICENSE_CHOICES[0], { nonNullable: true }),
  });

  // Catalogue.
  readonly catalogId = signal(this.catalogService.catalogs[0].id);
  readonly catalog = computed<MusicCatalog>(() => this.catalogService.find(this.catalogId()) ?? this.catalogService.catalogs[0]);
  readonly query = new FormControl('', { nonNullable: true });
  readonly keyInput = new FormControl('', { nonNullable: true });
  readonly results = signal<CatalogTrack[]>([]);
  readonly page = signal(1);
  readonly hasMore = signal(false);
  readonly searching = signal(false);
  readonly searched = signal(false);
  readonly searchError = signal('');
  readonly addingId = signal('');
  private searchController?: AbortController;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.controller?.abort();
      this.searchController?.abort();
    });
  }

  setMode(mode: 'url' | 'catalog'): void {
    this.mode.set(mode);
    this.error.set('');
    this.success.set('');
    if (mode === 'catalog') void this.keys.load();
  }

  async addUrl(): Promise<void> {
    if (this.busyLabel()) return;
    const value = this.urlForm.getRawValue();
    if (!value.url.trim()) {
      this.error.set('Collez d’abord l’adresse d’un fichier audio.');
      return;
    }
    await this.run('Téléchargement et vérification du fichier…', (onProgress, signal) =>
      this.online.addFromUrl({ ...value, category: this.category.value }, onProgress, signal),
    );
    if (this.success()) this.urlForm.reset({ url: '', title: '', artist: '', license: LICENSE_CHOICES[0] });
  }

  async addFromCatalog(item: CatalogTrack): Promise<void> {
    if (this.busyLabel()) return;
    this.addingId.set(item.externalId);
    await this.run(`Vérification de « ${item.title} »…`, (onProgress, signal) =>
      this.online.addFromCatalog(item, this.catalog().label, this.category.value, onProgress, signal),
    );
    this.addingId.set('');
  }

  isAdded(item: CatalogTrack): boolean {
    return this.online.isAdded(item.audioUrl);
  }

  cancel(): void {
    this.controller?.abort();
  }

  /**
   * Ces deux formulaires ne sont pas reliés à un FormGroup : sans preventDefault,
   * le navigateur rechargerait la page à la validation (la clé et la recherche seraient perdues).
   */
  submitKey(event: Event): void {
    event.preventDefault();
    this.saveKey();
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    void this.search(1);
  }

  saveKey(): void {
    this.keys.saveJamendoClientId(this.keyInput.value);
    this.keyInput.setValue('');
    this.searchError.set('');
  }

  forgetKey(): void {
    this.keys.saveJamendoClientId('');
    this.results.set([]);
    this.searched.set(false);
  }

  async search(page = 1): Promise<void> {
    this.searchController?.abort();
    const controller = new AbortController();
    this.searchController = controller;
    this.searching.set(true);
    this.searchError.set('');
    try {
      const result = await this.catalog().search(this.query.value, page, controller.signal);
      this.results.set(result.results);
      this.page.set(result.page);
      this.hasMore.set(result.hasMore);
      this.searched.set(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('[OnlineTrackAdd] Recherche impossible', error);
      this.searchError.set(error instanceof CatalogError ? error.message : 'La recherche a échoué. Réessayez.');
    } finally {
      if (this.searchController === controller) this.searching.set(false);
    }
  }

  formatDuration(seconds: number | null): string {
    if (!seconds) return '';
    return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
  }

  formatBytes(bytes: number): string {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`;
  }

  /** Lance un ajout avec indicateur de chargement, détection de lenteur, annulation et message d'erreur. */
  private async run(
    label: string,
    task: (onProgress: (progress: DownloadProgress) => void, signal: AbortSignal) => Promise<Track>,
  ): Promise<void> {
    this.controller = new AbortController();
    this.busyLabel.set(label);
    this.progress.set(null);
    this.slow.set(false);
    this.error.set('');
    this.success.set('');
    this.startedAt = performance.now();
    try {
      const track = await task((progress) => {
        this.progress.set(progress);
        const elapsed = (performance.now() - this.startedAt) / 1000;
        this.slow.set(elapsed > 4 && progress.bytesPerSecond < SLOW_BYTES_PER_SECOND);
      }, this.controller.signal);
      this.success.set(`« ${track.title} » a été ajouté à votre liste.`);
      this.added.emit(track);
    } catch (error) {
      console.error('[OnlineTrackAdd] Ajout impossible', error);
      this.error.set(error instanceof OnlineAudioError ? error.message : 'L’ajout a échoué pour une raison inattendue. Réessayez.');
    } finally {
      this.busyLabel.set('');
      this.progress.set(null);
      this.slow.set(false);
    }
  }
}
