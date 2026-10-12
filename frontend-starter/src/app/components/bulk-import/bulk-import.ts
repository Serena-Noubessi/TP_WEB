import { Component, computed, inject, OnDestroy, output, signal } from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { readAudioTags } from '../../shared/audio/id3-reader';
import { CATEGORIES, findCategory, guessCategory, MusicCategory, titleWithCategory } from '../../shared/models/category.model';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']);
/** Envois simultanés : assez pour aller vite, sans surcharger le serveur. */
const PARALLEL_UPLOADS = 3;

interface ImportItem {
  file: File;
  title: string;
  category: MusicCategory | undefined;
  status: 'waiting' | 'sending' | 'done' | 'skipped' | 'error';
  message?: string;
}

/**
 * Import de plusieurs morceaux à la fois (un dossier entier ou une sélection de fichiers),
 * avec classement automatique : nom du dossier (« 01-house ») ou genre écrit dans le MP3 (ID3).
 * Chaque morceau passe par la route existante POST /api/tracks.
 */
@Component({
  selector: 'app-bulk-import',
  templateUrl: './bulk-import.html',
  styleUrl: './bulk-import.css',
})
export class BulkImportComponent implements OnDestroy {
  private readonly service = inject(TrackService);
  readonly imported = output<void>();
  readonly categories = CATEGORIES;

  readonly items = signal<ImportItem[]>([]);
  readonly ignored = signal(0);
  readonly analysing = signal(false);
  readonly running = signal(false);
  readonly fallbackCategory = signal('autre');
  readonly summary = signal('');
  private cancelled = false;

  readonly groups = computed(() => {
    const fallback = findCategory(this.fallbackCategory());
    const groups = new Map<string, { category: MusicCategory | undefined; count: number }>();
    for (const item of this.items()) {
      const category = item.category ?? fallback;
      const key = category?.id ?? 'aucune';
      groups.set(key, { category, count: (groups.get(key)?.count ?? 0) + 1 });
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  });
  readonly unrecognised = computed(() => this.items().filter((item) => !item.category).length);
  readonly finished = computed(() => this.items().filter((item) => item.status === 'done' || item.status === 'skipped' || item.status === 'error').length);
  readonly percent = computed(() => (this.items().length ? Math.round((this.finished() / this.items().length) * 100) : 0));
  /** Morceaux encore à envoyer (en attente ou en erreur) : le bouton d'import n'affiche que ceux-là. */
  readonly remaining = computed(() => this.items().filter((item) => item.status === 'waiting' || item.status === 'error').length);
  readonly errors = computed(() => this.items().filter((item) => item.status === 'error'));

  ngOnDestroy(): void {
    this.cancelled = true;
  }

  async choose(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length || this.running()) return;
    this.analysing.set(true);
    this.summary.set('');
    const accepted = files.filter((file) => ALLOWED_AUDIO_TYPES.has(file.type) && file.size <= MAX_AUDIO_FILE_SIZE);
    this.ignored.set(files.length - accepted.length);

    const items: ImportItem[] = [];
    for (const file of accepted) {
      const tags = await readAudioTags(file).catch(() => ({}) as Awaited<ReturnType<typeof readAudioTags>>);
      const folder = file.webkitRelativePath.split('/').slice(-2, -1)[0] ?? '';
      items.push({
        file,
        title: tags.title || this.titleFromName(file.name),
        category: guessCategory(folder) ?? guessCategory(tags.genre),
        status: 'waiting',
      });
    }
    items.sort((a, b) => a.file.name.localeCompare(b.file.name));
    this.items.set(items);
    this.analysing.set(false);
  }

  setFallback(event: Event): void {
    this.fallbackCategory.set((event.target as HTMLSelectElement).value);
  }

  clear(): void {
    this.items.set([]);
    this.ignored.set(0);
    this.summary.set('');
  }

  cancel(): void {
    this.cancelled = true;
  }

  async start(): Promise<void> {
    if (this.running() || !this.items().length) return;
    this.running.set(true);
    this.cancelled = false;
    const fallback = findCategory(this.fallbackCategory());
    const queue = this.items().map((_, index) => index).filter((index) => this.items()[index].status === 'waiting' || this.items()[index].status === 'error');

    const worker = async () => {
      while (queue.length && !this.cancelled) {
        const index = queue.shift() as number;
        const item = this.items()[index];
        const title = titleWithCategory(item.title, item.category ?? fallback);
        this.patch(index, { status: 'sending' });
        try {
          if (await this.alreadyExists(title)) {
            this.patch(index, { status: 'skipped', message: 'déjà présent' });
          } else {
            await this.upload(item.file, title);
            this.patch(index, { status: 'done' });
          }
        } catch (error) {
          const message =
            error instanceof HttpErrorResponse && error.status === 0
              ? 'fichier illisible ou serveur injoignable'
              : error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
                ? error.error.message
                : 'envoi impossible';
          this.patch(index, { status: 'error', message });
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL_UPLOADS }, worker));

    const done = this.items().filter((item) => item.status === 'done').length;
    const skipped = this.items().filter((item) => item.status === 'skipped').length;
    const failed = this.errors().length;
    this.summary.set(
      `${done} morceau(x) importé(s)` +
        (skipped ? `, ${skipped} déjà présent(s)` : '') +
        (failed ? `, ${failed} en erreur` : '') +
        (this.cancelled ? ' — import interrompu.' : '.'),
    );
    this.running.set(false);
    this.imported.emit();
  }

  categoryLabel(item: ImportItem): string {
    const category = item.category ?? findCategory(this.fallbackCategory());
    return category ? `${category.icon} ${category.label}` : '—';
  }

  private patch(index: number, change: Partial<ImportItem>): void {
    this.items.update((items) => items.map((item, position) => (position === index ? { ...item, ...change } : item)));
  }

  /** Un morceau portant exactement le même titre (catégorie comprise) est considéré comme déjà importé. */
  private alreadyExists(title: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.service.list(1, 20, title).subscribe({
        next: (response) => {
          const docs: Track[] = 'docs' in response ? response.docs : response.items;
          resolve(docs.some((track) => track.title === title));
        },
        error: () => resolve(false),
      });
    });
  }

  private upload(file: File, title: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.service.upload(file, title).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.Response) resolve();
        },
        error: (error: HttpErrorResponse) => {
          console.error('[BulkImport] Envoi impossible', file.name, error);
          reject(error);
        },
      });
    });
  }

  /** « 01-stellar-rooftop-120bpm-gm.mp3 » → « Stellar Rooftop ». */
  private titleFromName(name: string): string {
    const base = name
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/^\d+[-_ ]+/, '')
      .replace(/[-_ ]\d+bpm.*$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return base.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) || name;
  }
}
