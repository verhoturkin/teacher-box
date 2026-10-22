import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BackupsPage } from './backups-page';

describe('admin BackupsPage', () => {
  it('puts the backups card of the administrator in a pane', async () => {
    TestBed.configureTestingModule({ imports: [BackupsPage], providers: testProviders() });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BackupsPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/backups').flush([]);
    backend.expectOne('/api/admin/backups/google').flush({
      connected: true,
      account: null,
      connectedAt: null,
      lastUploadAt: null,
      lastUploadName: null,
      lastError: null,
      running: null,
    });
    backend
      .expectOne('/api/admin/backups/google/files')
      .flush([{ id: 'cloud-1', name: 'teacherbox-copy.zip', size: 1024, createdAt: null }]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('tb-pane tb-backups-card')).not.toBeNull();
    expect(readableText(host)).toContain('Копии');
    expect(readableText(host)).toContain('teacherbox-copy.zip');
    expect(readableText(host)).not.toContain('Отключить');
    buttonByText(host, 'Перенести на сервер: teacherbox-copy.zip').click();
    backend
      .expectOne({ method: 'POST', url: '/api/admin/backups/google/files/cloud-1/download' })
      .flush({ id: 'cloud-1', name: 'teacherbox-copy.zip', size: 1024, createdAt: null });
    backend.expectOne('/api/admin/backups/google').flush({ connected: false, running: null });
    await fixture.whenStable();
    expect(readableText(host)).toContain(
      'Подключить Google Диск или изменить доступ может учитель',
    );
    backend.verify();
  });
});
