import { HttpErrorResponse, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { TracksPageComponent } from './tracks-page';

describe('TracksPageComponent upload', () => {
  let uploadEvents: Subject<HttpEvent<Track>>;
  let service: {
    list: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
  };
  let component: TracksPageComponent;

  beforeEach(() => {
    uploadEvents = new Subject<HttpEvent<Track>>();
    service = {
      list: vi.fn(() =>
        of({
          docs: [],
          totalDocs: 0,
          limit: 5,
          page: 1,
          totalPages: 1,
          nextPage: null,
          prevPage: null,
          hasPrevPage: false,
          hasNextPage: false,
          pagingCounter: 0,
        }),
      ),
      upload: vi.fn(() => uploadEvents.asObservable()),
    };

    TestBed.configureTestingModule({
      imports: [TracksPageComponent],
      providers: [{ provide: TrackService, useValue: service }],
    });
    component = TestBed.createComponent(TracksPageComponent).componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche la progression, bloque un second envoi et affiche l’échec', () => {
    const audio = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.file = audio;

    component.upload();
    component.upload();
    expect(component.uploading()).toBe(true);
    expect(service.upload).toHaveBeenCalledTimes(1);

    uploadEvents.next({
      type: HttpEventType.UploadProgress,
      loaded: 25,
      total: 100,
    });
    expect(component.uploadProgress()).toBe(25);

    uploadEvents.error(
      new HttpErrorResponse({
        status: 500,
        error: { message: 'Upload failed' },
      }),
    );
    expect(component.uploading()).toBe(false);
    expect(component.uploadError()).toBe('Upload failed');
  });

  it('affiche le succès et efface le fichier après la réponse finale', () => {
    const audio = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
    component.file = audio;
    component.title.setValue('Titre choisi');
    component.upload();

    const track: Track = {
      id: 'track-1',
      title: 'Titre choisi',
      originalName: 'song.mp3',
      mimeType: 'audio/mpeg',
      size: audio.size,
      coverUrl: null,
      createdAt: '2026-10-08T10:00:00.000Z',
    };
    uploadEvents.next(new HttpResponse({ body: track }));

    expect(component.uploading()).toBe(false);
    expect(component.uploadProgress()).toBe(100);
    expect(component.uploadSuccess()).toBe('Piste ajoutée avec succès.');
    expect(component.file).toBeUndefined();
    expect(component.title.value).toBe('');
    // Seuls les chargements de la liste (5 pistes par page) comptent : les autres appels (limit 1)
    // servent au comptage des morceaux par catégorie.
    expect(service.list.mock.calls.filter((call: unknown[]) => call[1] === 5)).toHaveLength(2);
  });
});
