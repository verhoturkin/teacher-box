import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aiStatus, aiUsage } from '@testing/admin-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { AiStatus, AiUsage } from '../data-access/admin.models';
import { IntegrationsPage } from './integrations-page';
import { screenWidth, testProviders } from '@testing/setup';

describe('IntegrationsPage', () => {
  let fixture: ComponentFixture<IntegrationsPage>;
  let backend: HttpTestingController;

  async function render(
    status: AiStatus,
    usage: AiUsage,
    section = 'ai',
    width?: number,
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [IntegrationsPage],
      providers: [...testProviders(), ...(width === undefined ? [] : [screenWidth(width)])],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IntegrationsPage);
    fixture.componentRef.setInput('section', section);
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
    fixture.componentRef.setInput('section', 'ai');
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

  it('checks the integrations in the first section', async () => {
    await render(aiStatus(), aiUsage(), 'connections');

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Telegram Работает Бот @school_bot отвечает 120 мс');
    expect(text).toContain('ИИ (anthropic) Ошибка Anthropic API 401: invalid x-api-key 300 мс');
    expect(text).toContain('MAX Не подключено Бот не подключён');
    expect(hostElement(fixture).querySelector('tbody')).toBeNull();
  });

  it('shows the AI requests in the second section', async () => {
    await render(aiStatus(), aiUsage());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('anthropic · claude-opus-5 · в этом месяце 12');
    expect(text).toMatch(/HOMEWORK_DRAFT Готово 420 \/ 180 1[.,]5 с/);
    expect(text).toContain('Ошибка Anthropic API 529: Overloaded');
    expect(hostElement(fixture).querySelector('a[aria-current="page"]')?.textContent).toContain(
      'Запросы к ИИ',
    );
  });

  it('shows the first section beside the list while none is chosen', async () => {
    await render(aiStatus(), aiUsage(), 'connections');
    fixture.componentRef.setInput('section', undefined);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Telegram Работает');
  });

  it('on a phone shows a section alone with «back» to the list', async () => {
    await render(aiStatus(), aiUsage(), 'ai', 390);

    expect(hostElement(fixture).querySelector('tb-pane-nav')).toBeNull();
    expect(hostElement(fixture).querySelector('a[href="/admin/integrations"]')).not.toBeNull();
  });

  it('explains when AI is off', async () => {
    await render(aiStatus({ enabled: false, monthlyTokenLimit: 0 }), aiUsage({ recent: [] }));
    expect(readableText(hostElement(fixture))).toContain('ИИ-помощник не настроен');
    expect(readableText(hostElement(fixture))).toContain('В этом месяце запросов не было');
  });

  it('shows a failed check', async () => {
    await render(aiStatus(), aiUsage(), 'connections');

    buttonByText(hostElement(fixture), 'Проверить').click();
    backend
      .expectOne('/api/admin/integrations/check')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Не удалось выполнить проверку');
  });

  it('adds older AI requests by «Показать ещё»', async () => {
    const usage = aiUsage({ moreRecent: true });
    await render(aiStatus(), usage);

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    buttonByText(hostElement(fixture), 'Показать ещё').click();
    backend
      .expectOne('/api/admin/ai/requests?month=2026-09&offset=2')
      .flush({ items: usage.recent, hasMore: true });
    await fixture.whenStable();
    expect(hostElement(fixture).querySelectorAll('tbody tr')).toHaveLength(4);

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    backend
      .expectOne('/api/admin/ai/requests?month=2026-09&offset=4')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Показать ещё');
  });

  it('shows the monthly limit when there is one', async () => {
    await render(aiStatus({ monthlyTokenLimit: 5_000 }), aiUsage({ recent: [] }));

    expect(readableText(hostElement(fixture))).toMatch(/из 5[\s,.]?000/);
  });
});
