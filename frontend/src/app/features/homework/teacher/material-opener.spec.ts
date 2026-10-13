import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { FileOpener } from '@shared/files/file-opener';
import { attachment, boundTextbook } from '@testing/homework-fixtures';
import { testProviders } from '@testing/setup';
import { MaterialOpener, firstPage } from './material-opener';

describe('MaterialOpener', () => {
  it('finds the first bound page', () => {
    expect(firstPage('12-14, 20')).toBe(12);
    expect(firstPage('20, 7-8')).toBe(7);
    expect(firstPage(null)).toBeNull();
  });

  it('opens a textbook whole at its first page and a file of the assignment', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const backend = TestBed.inject(HttpTestingController);
    const open = vi.spyOn(TestBed.inject(FileOpener), 'open').mockImplementation((content) => {
      content.subscribe();
    });
    const materials = TestBed.inject(MaterialOpener);

    materials.textbook(boundTextbook({ textbookId: 't-1', pages: '12-14' }));
    backend.expectOne('/api/teacher/textbooks/t-1/file').flush(new Blob(['%PDF']));
    const [, showable, filename, page] = open.mock.calls[0] ?? [];
    expect(showable).toBe(true);
    expect(page).toBe(12);
    expect(filename?.(new Blob([], { type: 'application/pdf' }))).toBe('Spotlight 5.pdf');

    materials.textbook(boundTextbook({ textbookId: 'w', format: 'DOCUMENT', pages: null }));
    backend.expectOne('/api/teacher/textbooks/w/file').flush(new Blob(['PK']));
    expect(open.mock.calls[1]?.[1]).toBe(false);

    materials.file(attachment({ id: 'f-1', contentType: 'application/zip', filename: 'a.zip' }));
    backend.expectOne('/api/teacher/homework/attachments/f-1').flush(new Blob(['PK']));
    expect(open.mock.calls[2]?.[1]).toBe(false);
    expect(open.mock.calls[2]?.[2](new Blob())).toBe('a.zip');
    await Promise.resolve();
  });
});
