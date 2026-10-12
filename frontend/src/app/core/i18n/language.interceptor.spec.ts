import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LANGUAGE_KEY, forgetLanguage } from './language';
import { languageInterceptor } from './language.interceptor';

describe('languageInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([languageInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    localStorage.removeItem(LANGUAGE_KEY);
    forgetLanguage();
  });

  it('tells the server the language of the page', () => {
    localStorage.setItem(LANGUAGE_KEY, 'en');
    forgetLanguage();

    http.get('/api/admin/settings').subscribe();
    http.get('/assets/logo.svg').subscribe();

    expect(backend.expectOne('/api/admin/settings').request.headers.get('Accept-Language')).toBe(
      'en',
    );
    expect(backend.expectOne('/assets/logo.svg').request.headers.has('Accept-Language')).toBe(
      false,
    );
  });
});
