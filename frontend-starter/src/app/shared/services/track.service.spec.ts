import {
  HttpEvent,
  HttpEventType,
  HttpUploadProgressEvent,
  provideHttpClient,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Track } from '../models/track.model';
import { TrackService } from './track.service';

describe('TrackService', () => {
  let service: TrackService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrackService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('transmet la page, la limite et le filtre à la requête de liste', () => {
    service.list(3, 5, 'blues').subscribe();

    const request = httpTesting.expectOne(
      (req) =>
        req.url === '/api/tracks' &&
        req.params.get('page') === '3' &&
        req.params.get('limit') === '5' &&
        req.params.get('search') === 'blues',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      docs: [],
      totalDocs: 0,
      limit: 5,
      page: 3,
      totalPages: 0,
      nextPage: null,
      prevPage: null,
      hasNextPage: false,
      hasPrevPage: false,
      pagingCounter: 0,
    });
  });

  it('émet la progression puis la réponse finale de l’upload multipart', () => {
    const audio = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
    const cover = new File(['cover'], 'cover.png', { type: 'image/png' });
    const events: HttpEvent<Track>[] = [];

    service.upload(audio, 'Song title', cover).subscribe((event) => events.push(event));

    const request = httpTesting.expectOne('/api/tracks');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.body.get('title')).toBe('Song title');
    expect(request.request.body.get('audio')).toBeInstanceOf(File);
    expect(request.request.body.get('cover')).toBeInstanceOf(File);

    const progress: HttpUploadProgressEvent = {
      type: HttpEventType.UploadProgress,
      loaded: 50,
      total: 100,
    };
    request.event(progress);
    expect(events.at(-1)?.type).toBe(HttpEventType.UploadProgress);

    const track: Track = {
      id: 'track-1',
      title: 'Song title',
      originalName: 'song.mp3',
      mimeType: 'audio/mpeg',
      size: audio.size,
      coverUrl: '/api/tracks/track-1/cover',
      createdAt: '2026-10-08T10:00:00.000Z',
    };
    request.flush(track);
    expect(events.at(-1)?.type).toBe(HttpEventType.Response);
    expect(events.at(-1)).toMatchObject({
      type: HttpEventType.Response,
      body: track,
    });
  });

  it('propage une erreur HTTP lorsque l’upload échoue', () => {
    const audio = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
    let receivedStatus: number | undefined;

    service.upload(audio, 'Song title').subscribe({
      error: (error: { status: number }) => {
        receivedStatus = error.status;
      },
    });

    const request = httpTesting.expectOne('/api/tracks');
    request.flush(
      { message: 'Upload failed' },
      { status: 500, statusText: 'Server Error' },
    );
    expect(receivedStatus).toBe(500);
  });
});
