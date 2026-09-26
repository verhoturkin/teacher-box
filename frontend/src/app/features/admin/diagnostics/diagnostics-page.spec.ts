import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { FileSaver } from '@shared/files/file-saver';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { ARCHIVE_NAME, DiagnosticsPage } from './diagnostics-page';

describe('DiagnosticsPage', () => {
  let fixture: ComponentFixture<DiagnosticsPage>;
  let backend: HttpTestingController;
  let save: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    save = vi.fn();
    TestBed.configureTestingModule({
      imports: [DiagnosticsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
        { provide: FileSaver, useValue: { save } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DiagnosticsPage);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('explains what to send and downloads the archive', () => {
    expect(readableText(hostElement(fixture))).toContain('Код ошибки из сообщения');

    buttonByText(hostElement(fixture), 'Скачать архив').click();
    const archive = new Blob(['zip']);
    backend.expectOne('/api/admin/diagnostics').flush(archive);

    expect(save).toHaveBeenCalledWith(archive, ARCHIVE_NAME);
  });

  it('survives a failed download', () => {
    fixture.componentInstance.download();
    backend.expectOne('/api/admin/diagnostics').flush(new Blob(), { status: 500, statusText: 'Error' });

    expect(save).not.toHaveBeenCalled();
  });
});
