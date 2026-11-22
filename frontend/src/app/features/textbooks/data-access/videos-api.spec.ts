import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { testProviders } from '@testing/setup';
import { VideosApi } from './videos-api';

describe('VideosApi', () => {
  let api: VideosApi;
  let backend: HttpTestingController;
  const url = 'https://youtu.be/dQw4w9WgXcQ';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    api = TestBed.inject(VideosApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('asks the tracks of a video', () => {
    api.captions(url).subscribe();
    const request = backend.expectOne('/api/teacher/textbooks/videos/captions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ url });
    request.flush({ title: null, tracks: [], suggested: { language: 'en', automatic: true } });
  });

  it('takes the suggested track without a language and the chosen one with it', () => {
    api.transcript(url).subscribe();
    const suggested = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    expect(suggested.request.body).toEqual({ url });
    suggested.flush({});
    api.transcript(url, { language: 'ru', automatic: false }).subscribe();
    const chosen = backend.expectOne('/api/teacher/textbooks/videos/transcript');
    expect(chosen.request.body).toEqual({ url, language: 'ru', automatic: false });
    chosen.flush({});
  });
});
