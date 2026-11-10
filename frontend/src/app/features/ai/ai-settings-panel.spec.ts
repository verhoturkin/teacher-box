import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { aiProvider, aiSettings, systemPrompt, usageReport } from '@testing/ai-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { AiSettings, UsageReport } from './data-access/ai.models';
import { AiSettingsPanel } from './ai-settings-panel';
import { testProviders } from '@testing/setup';

describe('AiSettingsPanel', () => {
  let fixture: ComponentFixture<AiSettingsPanel>;
  let backend: HttpTestingController;

  const twoModels: UsageReport['models'] = [
    {
      modelId: 'm-1',
      label: 'Claude Opus 5',
      provider: 'anthropic',
      removed: false,
      requests: 3,
      inputTokens: 300_000,
      outputTokens: 100_000,
    },
    {
      modelId: null,
      label: 'deepseek-old',
      provider: 'deepseek',
      removed: true,
      requests: 1,
      inputTokens: 80_000,
      outputTokens: 20_000,
    },
  ];

  async function render(
    report: UsageReport = usageReport(),
    settings: AiSettings = aiSettings({ monthlyTokenLimit: 2_000_000 }),
  ): Promise<string> {
    TestBed.configureTestingModule({
      imports: [AiSettingsPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(AiSettingsPanel);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/ai/providers').flush([aiProvider()]);
    backend.expectOne('/api/teacher/ai/settings').flush(settings);
    backend.expectOne('/api/teacher/ai/usage').flush(report);
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

  it('shows the connections, the share of the limit and the usage split by model', async () => {
    const text = await render(usageReport({ models: twoModels }));

    expect(text).toContain('Подключения');
    expect(text).toContain('Claude Opus 5');
    expect(text).toContain('Расход за сентябрь');
    expect(text).toMatch(
      /25 % месячного лимита · 500.000 из 2.000.000 токенов · обнулится 1 октября/,
    );
    expect(text).toContain('Claude Opus 5 · 20 %');
    expect(text).toContain('deepseek-old (удалена) · 5 %');
    expect(hostElement(fixture).querySelectorAll('.tb-ai__bar > i')).toHaveLength(2);
    expect(text).toContain('Общий для всех подключений');
    expect(text).toContain('Мои промты');
    expect(text).toContain('Системные промты');
  });

  it('splits the month by model as shares of the tokens when there is no limit', async () => {
    const text = await render(
      usageReport({ models: twoModels }),
      aiSettings({ monthlyTokenLimit: 0 }),
    );

    expect(text).toContain('токенов за месяц, без лимита');
    expect(text).toContain('Claude Opus 5 · 80 %');
    expect(text).toContain('deepseek-old (удалена) · 20 %');
  });

  it('has no bar while no model was used', async () => {
    await render(usageReport({ models: [] }));

    expect(hostElement(fixture).querySelector('.tb-ai__bar')).toBeNull();
  });

  it('saves the limit on leaving the field when it changed', async () => {
    await render();
    const field = requireElement(hostElement(fixture), '#ai-limit', HTMLInputElement);

    field.dispatchEvent(new FocusEvent('blur'));
    backend.expectNone('/api/teacher/ai/settings');

    field.value = '5000';
    field.dispatchEvent(new InputEvent('input', { data: '5000' }));
    field.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/settings' });
    expect(request.request.body).toEqual(aiSettings({ monthlyTokenLimit: 5000 }));
    request.flush(aiSettings({ monthlyTokenLimit: 5000, version: 2 }));
    await fixture.whenStable();

    expect(TestBed.inject(MessageService).add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Лимит сохранён' }),
    );
    expect(readableText(hostElement(fixture))).toMatch(/из 5.000 токенов/);
  });

  it('folds the system prompts, open at first', async () => {
    await render();
    const fold = buttonByText(hostElement(fixture), 'Системные промты');
    const body = hostElement(fixture).querySelector<HTMLElement>('#system-prompts');

    expect(fold.getAttribute('aria-expanded')).toBe('true');
    fold.click();
    await fixture.whenStable();

    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);
  });

  it('lists the recent requests of the month with the model, tokens and status', async () => {
    const text = await render();

    expect(text).toContain('Последние запросы · сентябрь');
    expect(text).toMatch(/Черновик задания .* claude-opus-5 · 300 → 700 токенов · 13 с Готово/);
    expect(text).toMatch(
      /Черновик проверки .* 0 → 0 токенов · 1 с Anthropic API 529: Overloaded Ошибка/,
    );
  });

  it('adds older requests by «Показать ещё» and keeps it when loading fails', async () => {
    const report = usageReport({ moreRecent: true });
    expect(await render(report)).toContain('Показать ещё');
    const older = report.recent[0];
    if (older === undefined) {
      throw new Error('a request is expected');
    }

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    buttonByText(hostElement(fixture), 'Показать ещё').click();
    backend
      .expectOne('/api/teacher/ai/requests?month=2026-09&offset=2')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('Показать ещё');

    buttonByText(hostElement(fixture), 'Показать ещё').click();
    backend
      .expectOne('/api/teacher/ai/requests?month=2026-09&offset=2')
      .flush({ items: [{ ...older, model: 'claude-old' }], hasMore: false });
    await fixture.whenStable();

    expect(
      hostElement(fixture).querySelectorAll('ul[aria-label^="Последние запросы"] > li'),
    ).toHaveLength(3);
    expect(readableText(hostElement(fixture))).not.toContain('Показать ещё');
  });

  it('says when the month has no requests', async () => {
    const text = await render(usageReport({ recent: [] }));

    expect(text).toContain('Запросов в этом месяце не было');
  });

  it('caps the share at 100%', async () => {
    await render(usageReport({ usedTokens: 3_000_000 }));

    expect(readableText(hostElement(fixture))).toContain('100 % месячного лимита');
  });
});
