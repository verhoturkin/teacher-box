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
    expect(text).toMatch(/25 % месячного лимита · обнулится 1 октября/);
    expect(text).toContain('Больше всего — Черновики заданий (20 %), Черновики проверки (5 %).');
    expect(hostElement(fixture).querySelector('p-progressbar')).not.toBeNull();
    expect(text).toContain('Мои промты');
    expect(text).toContain('Системные промты');
  });

  it('shows unlimited usage without a bar', async () => {
    const text = await render(aiStatus(), usageReport({ monthlyTokenLimit: 0 }));

    expect(text).toContain('токенов за месяц, без лимита');
    expect(hostElement(fixture).querySelector('p-progressbar')).toBeNull();
  });

  it('unfolds the system prompts', async () => {
    await render(aiStatus(), usageReport());
    const fold = buttonByText(hostElement(fixture), 'Системные промты');
    const body = hostElement(fixture).querySelector<HTMLElement>('#system-prompts');

    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);
    fold.click();
    await fixture.whenStable();

    expect(fold.getAttribute('aria-expanded')).toBe('true');
    expect(body?.hidden).toBe(false);
  });

  it('caps the progress bar at 100%', async () => {
    await render(aiStatus(), usageReport({ usedTokens: 3_000_000 }));

    const bar = hostElement(fixture).querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');
  });
});
