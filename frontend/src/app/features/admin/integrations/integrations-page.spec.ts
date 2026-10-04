import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aiStatus, aiUsage } from '@testing/admin-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { AiStatus, AiUsage } from '../data-access/admin.models';
import { IntegrationsPage } from './integrations-page';
import { testProviders } from '@testing/setup';

describe('IntegrationsPage', () => {
  let fixture: ComponentFixture<IntegrationsPage>;
  let backend: HttpTestingController;

  async function render(status: AiStatus, usage: AiUsage): Promise<void> {
    TestBed.configureTestingModule({
      imports: [IntegrationsPage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IntegrationsPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/integrations/check').flush([
      { name: 'Telegram', state: 'OK', detail: 'Бот @school_bot отвечает', millis: 120 },
      {
        name: 'ИИ (anthropic)',
        state: 'FAILED',
        detail: 'Anthropic API 401: invalid x-api-key',
        millis: 300,
      },
      { name: 'MAX', state: 'NOT_CONFIGURED', detail: 'Бот не подключён', millis: 0 },
    ]);
    backend.expectOne('/api/admin/ai/status').flush(status);
    backend.expectOne('/api/admin/ai/usage').flush(usage);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows a failed load of the AI requests with «Повторить»', async () => {
    TestBed.configureTestingModule({ imports: [IntegrationsPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IntegrationsPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/integrations/check').flush([]);
    backend.expectOne('/api/admin/ai/usage').flush(aiUsage());
    backend.expectOne('/api/admin/ai/status').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось загрузить запросы к ИИ');

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/admin/ai/status').flush(aiStatus());
    backend.expectOne('/api/admin/ai/usage').flush(aiUsage());
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('anthropic · claude-opus-5');
  });

  it('checks the integrations and shows the AI requests', async () => {
    await render(aiStatus(), aiUsage());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram Работает Бот @school_bot отвечает 120 мс');
    expect(text).toContain('ИИ (anthropic) Ошибка Anthropic API 401: invalid x-api-key 300 мс');
    expect(text).toContain('MAX Не подключено Бот не подключён Запросы к ИИ');
    expect(text).toContain('anthropic · claude-opus-5 · в этом месяце 12');
    expect(text).toMatch(/HOMEWORK_DRAFT Готово 420 \/ 180 1[.,]5 с/);
    expect(text).toContain('Ошибка Anthropic API 529: Overloaded');
  });

  it('explains when AI is off and shows a failed check', async () => {
    await render(aiStatus({ enabled: false, monthlyTokenLimit: 0 }), aiUsage({ recent: [] }));
    expect(readableText(hostElement(fixture))).toContain('ИИ-помощник не настроен');
    expect(readableText(hostElement(fixture))).toContain('В этом месяце запросов не было');

    buttonByText(hostElement(fixture), 'Проверить').click();
    backend
      .expectOne('/api/admin/integrations/check')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось выполнить проверку');
  });

  it('shows the monthly limit when there is one', async () => {
    await render(aiStatus({ monthlyTokenLimit: 5_000 }), aiUsage({ recent: [] }));

    expect(readableText(hostElement(fixture))).toMatch(/из 5[\s,.]?000/);
  });
});
