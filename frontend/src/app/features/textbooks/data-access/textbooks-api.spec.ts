import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aTextbook } from '@testing/textbooks-fixtures';
import { formData } from '@testing/form-data';
import { testProviders } from '@testing/setup';
import { TextbooksApi, textbookPageUrl } from './textbooks-api';

describe('TextbooksApi', () => {
  let api: TextbooksApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    api = TestBed.inject(TextbooksApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('sends a new textbook with its file as a form', () => {
    const file = new File(['%PDF-'], 'Spotlight.pdf', { type: 'application/pdf' });
    api
      .create(
        {
          kind: 'WORKBOOK',
          title: 'Тетрадь',
          course: 'Английский',
          pageCount: 48,
          studentIds: ['s-1', 's-2'],
          groupIds: ['g-1'],
        },
        file,
      )
      .subscribe();
    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks' });
    const form = formData(request.request.body);
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('kind')).toBe('WORKBOOK');
    expect(form.get('course')).toBe('Английский');
    expect(form.get('pageCount')).toBe('48');
    expect(form.getAll('studentIds')).toEqual(['s-1', 's-2']);
    expect(form.getAll('groupIds')).toEqual(['g-1']);
    request.flush(aTextbook());

    api
      .create(
        {
          kind: 'OTHER',
          title: 'Скан',
          course: null,
          pageCount: null,
          studentIds: [],
          groupIds: [],
        },
        file,
      )
      .subscribe();
    const bare = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks' });
    expect(formData(bare.request.body).has('course')).toBe(false);
    expect(formData(bare.request.body).has('pageCount')).toBe(false);
    bare.flush(aTextbook());
  });

  it('changes, replaces the file, deletes and downloads', () => {
    const textbook = aTextbook({ version: 3 });
    api
      .change(textbook, {
        kind: 'TEXTBOOK',
        title: 'Новое',
        course: null,
        pageCount: null,
        studentIds: [],
        groupIds: [],
      })
      .subscribe();
    const change = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/tb-1' });
    expect(change.request.body).toMatchObject({ title: 'Новое', version: 3 });
    change.flush(textbook);

    api.replaceFile(textbook, new File(['x'], 'скан.png')).subscribe();
    const replace = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/tb-1/file' });
    expect(formData(replace.request.body).get('version')).toBe('3');
    replace.flush(textbook);

    let removed = false;
    api.remove('tb-1').subscribe(() => (removed = true));
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/tb-1' }).flush(null);
    expect(removed).toBe(true);

    api.file('tb-1').subscribe();
    backend.expectOne('/api/teacher/textbooks/tb-1/file').flush(new Blob(['x']));
    api.myFile('tb-1').subscribe();
    backend.expectOne('/api/me/textbooks/tb-1/file').flush(new Blob(['x']));
    expect(textbookPageUrl('tb-1', 3)).toBe('/api/teacher/textbooks/tb-1/pages/3');
  });
});
