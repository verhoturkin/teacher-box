import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aiStatus, usageReport } from '@testing/ai-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { AiStatus, UsageReport } from './data-access/ai.models';
import { AiUsagePage } from './ai-usage-page';
import { testProviders } from '@testing/setup';

describe('AiUsagePage', () => {
  let fixture: ComponentFixture<AiUsagePage>;
  let backend: HttpTestingController;

  async function render(status: AiStatus, report?: UsageReport): Promise<string> {
    TestBed.configureTestingModule({
      imports: [AiUsagePage],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AiUsagePage);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/ai/status').flush(status);
    if (report !== undefined) {
      backend.expectOne('/api/teacher/ai/usage').flush(report);
    }
    await fixture.whenStable();
    for (const request of backend.match('/api/teacher/ai/prompts')) {
      request.flush([]);
    }
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('explains how to enable the assistant', async () => {
    const text = await render(aiStatus({ enabled: false, provider: null, model: null }));

    expect(text).toContain('ИИ-помощник не настроен');
    expect(text).toContain('попросите его подключить ИИ-помощника');
  });

  it('names Gemini', async () => {
    expect(
      await render(aiStatus({ provider: 'gemini', model: 'gemini-3.8-flash' }), usageReport()),
    ).toContain('Модель gemini-3.8-flash Google Gemini');
  });

  it('names OpenRouter', async () => {
    expect(
      await render(aiStatus({ provider: 'openrouter', model: 'openrouter/auto' }), usageReport()),
    ).toContain('Модель openrouter/auto OpenRouter');
  });

  it('names DeepSeek', async () => {
    expect(
      await render(aiStatus({ provider: 'deepseek', model: 'deepseek-flash' }), usageReport()),
    ).toContain('Модель deepseek-flash DeepSeek');
  });

  it('keeps an unknown provider id as is', async () => {
    expect(await render(aiStatus({ provider: 'custom', model: 'm' }), usageReport())).toContain(
      'Модель m custom',
    );
  });

  it('shows the model, the monthly usage and recent requests', async () => {
    const text = await render(aiStatus(), usageReport());

    expect(text).toContain('Модель claude-opus-5 Anthropic (Claude)');
    expect(text).toContain('Использование за сентябрь 2026');
    expect(text).toMatch(/Токенов: 500.000 из 2.000.000/);
    expect(text).toMatch(/Черновики заданий: 3 запроса, 3.000 токенов/);
    expect(text).toContain('Готово');
    expect(text).toContain('Ошибка Anthropic API 529: Overloaded');
    expect(text).toMatch(/12.5 с/);
    expect(hostElement(fixture).querySelector('p-progressbar')).not.toBeNull();
  });

  it('shows unlimited usage and an empty month', async () => {
    const text = await render(
      aiStatus({ monthlyTokenLimit: 0 }),
      usageReport({ monthlyTokenLimit: 0, recent: [] }),
    );

    expect(text).toContain('(без лимита)');
    expect(text).toContain('Запросов в этом месяце не было');
    expect(hostElement(fixture).querySelector('p-progressbar')).toBeNull();
  });

  it('adds older requests by «Показать ещё»', async () => {
    const report = usageReport({ moreRecent: true });
    expect(await render(aiStatus(), report)).toContain('Показать ещё');

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    const older = report.recent[0];
    if (older === undefined) {
      throw new Error('a request is expected');
    }
    backend
      .expectOne('/api/teacher/ai/requests?month=2026-09&offset=2')
      .flush({ items: [{ ...older, model: 'claude-old' }], hasMore: false });
    await fixture.whenStable();

    expect(hostElement(fixture).querySelectorAll('tbody tr')).toHaveLength(3);
    expect(readableText(hostElement(fixture))).not.toContain('Показать ещё');
  });

  it('keeps «Показать ещё» when loading more fails', async () => {
    await render(aiStatus(), usageReport({ moreRecent: true }));

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    buttonByText(hostElement(fixture), 'Показать ещё').click();
    backend
      .expectOne('/api/teacher/ai/requests?month=2026-09&offset=2')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(hostElement(fixture).querySelectorAll('tbody tr')).toHaveLength(2);
    expect(readableText(hostElement(fixture))).toContain('Показать ещё');
  });

  it('caps the progress bar at 100%', async () => {
    await render(aiStatus(), usageReport({ usedTokens: 3_000_000 }));

    const bar = hostElement(fixture).querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');
  });
});
