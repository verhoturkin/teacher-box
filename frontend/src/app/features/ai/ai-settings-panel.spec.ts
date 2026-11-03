import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aiStatus, systemPrompt, usageReport } from '@testing/ai-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { AiStatus, UsageReport } from './data-access/ai.models';
import { AiSettingsPanel } from './ai-settings-panel';
import { testProviders } from '@testing/setup';

describe('AiSettingsPanel', () => {
  let fixture: ComponentFixture<AiSettingsPanel>;
  let backend: HttpTestingController;

  async function render(status: AiStatus, report?: UsageReport): Promise<string> {
    TestBed.configureTestingModule({
      imports: [AiSettingsPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AiSettingsPanel);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/ai/status').flush(status);
    if (report !== undefined) {
      backend.expectOne('/api/teacher/ai/usage').flush(report);
    }
    await fixture.whenStable();
    for (const request of backend.match('/api/teacher/ai/prompts')) {
      request.flush([]);
    }
    for (const request of backend.match('/api/teacher/ai/system-prompts')) {
      request.flush([systemPrompt()]);
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

  it('shows the model, the share of the monthly limit and what used it', async () => {
    const text = await render(
      aiStatus(),
      usageReport({
        features: [
          { feature: 'HOMEWORK_DRAFT', requests: 3, inputTokens: 300_000, outputTokens: 100_000 },
          { feature: 'REVIEW_DRAFT', requests: 1, inputTokens: 80_000, outputTokens: 20_000 },
        ],
      }),
    );

    expect(text).toContain('claude-opus-5');
    expect(text).toContain('Подключает администратор портала');
    expect(text).toContain('Работает');
    expect(text).toMatch(
      /25 % месячного лимита · 500.000 из 2.000.000 токенов · обнулится 1 октября/,
    );
    expect(text).toContain('Черновики заданий · 20 %');
    expect(text).toContain('Черновики проверки · 5 %');
    expect(hostElement(fixture).querySelectorAll('.tb-ai__bar > i')).toHaveLength(2);
    expect(text).toContain('Мои промты');
    expect(text).toContain('Системные промты');
  });

  it('shows unlimited usage without a bar', async () => {
    const text = await render(aiStatus(), usageReport({ monthlyTokenLimit: 0 }));

    expect(text).toContain('токенов за месяц, без лимита');
    expect(hostElement(fixture).querySelector('.tb-ai__bar')).toBeNull();
  });

  it('folds the system prompts, open at first', async () => {
    await render(aiStatus(), usageReport());
    const fold = buttonByText(hostElement(fixture), 'Системные промты');
    const body = hostElement(fixture).querySelector<HTMLElement>('#system-prompts');

    expect(fold.getAttribute('aria-expanded')).toBe('true');
    expect(body?.hidden).toBe(false);
    fold.click();
    await fixture.whenStable();

    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);
  });

  it('lists the recent requests of the month with tokens and status', async () => {
    const text = await render(aiStatus(), usageReport());

    expect(text).toContain('Последние запросы · сентябрь');
    expect(text).toMatch(/Черновик задания .* 300 → 700 токенов · 13 с Готово/);
    expect(text).toMatch(
      /Черновик проверки .* 0 → 0 токенов · 1 с Anthropic API 529: Overloaded Ошибка/,
    );
    expect(hostElement(fixture).querySelector('.tb-i-rate_review')).not.toBeNull();
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

    expect(
      hostElement(fixture).querySelectorAll('ul[aria-label^="Последние запросы"] > li'),
    ).toHaveLength(3);
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

    expect(
      hostElement(fixture).querySelectorAll('ul[aria-label^="Последние запросы"] > li'),
    ).toHaveLength(2);
    expect(readableText(hostElement(fixture))).toContain('Показать ещё');
  });

  it('says when the month has no requests', async () => {
    const text = await render(aiStatus(), usageReport({ recent: [] }));

    expect(text).toContain('Запросов в этом месяце не было');
  });

  it('caps the bar at 100%', async () => {
    await render(aiStatus(), usageReport({ usedTokens: 3_000_000 }));

    expect(readableText(hostElement(fixture))).toContain('100 % месячного лимита');
  });
});
