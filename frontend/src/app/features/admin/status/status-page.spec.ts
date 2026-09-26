import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { systemStatus } from '@testing/admin-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { SystemStatus } from '../data-access/admin.models';
import { StatusPage } from './status-page';

describe('StatusPage', () => {
  let fixture: ComponentFixture<StatusPage>;
  let backend: HttpTestingController;

  async function render(status: SystemStatus): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StatusPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StatusPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/status').flush(status);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the state of the instance', async () => {
    await render(systemStatus());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Проверки UP db: UP diskSpace: UP');
    expect(text).toContain('Версия 1.1.0');
    expect(text).toContain('Работает 2 д 3 ч');
    expect(text).toContain('Память 100 МБ из 512 МБ');
    expect(text).toContain('Свободно на диске 20 ГБ из 100 ГБ');
    expect(text).toContain('База данных 5 МБ журналы: 1 МБ');
    expect(text).toContain('Данные: /data · часовой пояс Europe/Moscow');
    expect(hostElement(fixture).querySelector('.tb-negative')).toBeNull();
  });

  it('warns about a full disk and a failed check, and refreshes', async () => {
    await render(systemStatus({ version: null, builtAt: null, health: 'DOWN', diskFree: 1024 * 1024 * 1024 }));

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Проверки DOWN');
    expect(text).toContain('Версия разработка');
    expect(hostElement(fixture).querySelector('.tb-negative')).not.toBeNull();

    buttonByText(hostElement(fixture), 'Обновить').click();
    backend.expectOne('/api/admin/status').flush(systemStatus({ diskTotal: 0 }));
  });
});
