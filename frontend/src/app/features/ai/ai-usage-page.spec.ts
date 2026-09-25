import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { aiStatus, usageReport } from '@testing/ai-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { AiStatus, UsageReport } from './data-access/ai.models';
import { AiUsagePage } from './ai-usage-page';

describe('AiUsagePage', () => {
  let fixture: ComponentFixture<AiUsagePage>;
  let backend: HttpTestingController;

  async function render(status: AiStatus, report?: UsageReport): Promise<string> {
    TestBed.configureTestingModule({
      imports: [AiUsagePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AiUsagePage);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/ai/status').flush(status);
    if (report !== undefined) {
      backend.expectOne('/api/teacher/ai/usage').flush(report);
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
    expect(text).toContain('TEACHERBOX_AI_PROVIDER');
  });

  it('names Gemini', async () => {
    expect(await render(aiStatus({ provider: 'gemini', model: 'gemini-3.8-flash' }), usageReport())).toContain(
      'Модель gemini-3.8-flash Google Gemini',
    );
  });

  it('keeps an unknown provider id as is', async () => {
    expect(await render(aiStatus({ provider: 'custom', model: 'm' }), usageReport())).toContain('Модель m custom');
  });

  it('shows the model, the monthly usage and recent requests', async () => {
    const text = await render(aiStatus(), usageReport());

    expect(text).toContain('Модель claude-opus-5 Anthropic (Claude)');
    expect(text).toContain('Использование за 2026-09');
    expect(text).toMatch(/Токенов: 500.000 из 2.000.000/);
    expect(text).toMatch(/Черновики заданий: 3 запр., 3.000 токенов/);
    expect(text).toContain('Готово');
    expect(text).toContain('Ошибка Anthropic API 529: Overloaded');
    expect(text).toMatch(/12.5 с/);
    expect(hostElement(fixture).querySelector('p-progressbar')).not.toBeNull();
  });

  it('shows unlimited usage and an empty month', async () => {
    const text = await render(aiStatus({ monthlyTokenLimit: 0 }), usageReport({ monthlyTokenLimit: 0, recent: [] }));

    expect(text).toContain('(без лимита)');
    expect(text).toContain('Запросов в этом месяце не было');
    expect(hostElement(fixture).querySelector('p-progressbar')).toBeNull();
  });

  it('caps the progress bar at 100%', async () => {
    await render(aiStatus(), usageReport({ usedTokens: 3_000_000 }));

    const bar = hostElement(fixture).querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');
  });
});
