import { Clipboard } from '@angular/cdk/clipboard';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { aiProvider, answerModels } from '@testing/ai-fixtures';
import { aStudent, aTag } from '@testing/identity-fixtures';
import { buttonByText, hostElement, readableText, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { PeriodSummaryPanel } from './period-summary-panel';

describe('PeriodSummaryPanel', () => {
  let fixture: ComponentFixture<PeriodSummaryPanel>;
  let backend: HttpTestingController;
  let toasts: ReturnType<typeof vi.spyOn>;

  async function render(): Promise<{ panel: PeriodSummaryPanel; host: HTMLElement }> {
    TestBed.configureTestingModule({ imports: [PeriodSummaryPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    toasts = vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(PeriodSummaryPanel);
    fixture.componentRef.setInput('studentId', 'student-1');
    fixture.componentRef.setInput('from', '2026-10-01');
    fixture.componentRef.setInput('to', '2026-10-31');
    await fixture.whenStable();
    answerModels(backend, [aiProvider()]);
    backend.expectOne('/api/teacher/tags').flush([aTag()]);
    backend.expectOne('/api/teacher/students').flush([aStudent({ tags: { 'tag-1': 'v-2' } })]);
    await fixture.whenStable();
    return { panel: fixture.componentInstance, host: hostElement(fixture) };
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('writes a draft from the period and the student’s tags, then lets the teacher edit and copy it', async () => {
    const { panel, host } = await render();
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);

    buttonByText(host, 'Составить с ИИ').click();
    panel.generate();
    const request = backend.expectOne('/api/teacher/ai/period-summary');
    expect(request.request.body).toEqual({
      studentId: 'student-1',
      from: '2026-10-01',
      to: '2026-10-31',
      context: [{ name: 'Уровень', value: 'A2' }],
    });
    request.flush({ summary: '## Что прошли\n\nДроби' });
    await fixture.whenStable();

    const draft = host.querySelector<HTMLTextAreaElement>('#period-ai-draft');
    expect(draft?.value).toBe('## Что прошли\n\nДроби');
    expect(readableText(host)).toContain('Итоги не сохраняются');
    if (draft !== null) {
      typeInto(draft, 'Итоги октября');
    }
    await fixture.whenStable();
    expect(host.querySelector('.tb-print-only')?.textContent).toContain('Итоги октября');

    buttonByText(host, 'Копировать').click();
    expect(copy).toHaveBeenCalledWith('Итоги октября');
    expect(toasts).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'success' }));

    copy.mockReturnValue(false);
    buttonByText(host, 'Копировать').click();
    expect(toasts).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'error' }));

    panel.prompt.setValue(' Для родителей ');
    buttonByText(host, 'Составить заново').click();
    const again = backend.expectOne('/api/teacher/ai/period-summary');
    expect(again.request.body).toEqual(expect.objectContaining({ prompt: 'Для родителей' }));
    again.flush({ summary: 'Новый' });
    await fixture.whenStable();
    expect(draft?.value).toBe('Новый');
  });

  it('explains a period with nothing to summarise', async () => {
    const { panel, host } = await render();

    panel.generate();
    backend
      .expectOne('/api/teacher/ai/period-summary')
      .flush(
        { code: 'ai.period-empty', status: 422 },
        { status: 422, statusText: 'Unprocessable' },
      );
    await fixture.whenStable();

    expect(readableText(host)).toContain('нет ни занятий, ни заданий');
    expect(host.querySelector('#period-ai-draft')).toBeNull();
  });

  it('asks nothing while the period is invalid or the wishes are too long', async () => {
    const { panel, host } = await render();

    fixture.componentRef.setInput('ready', false);
    await fixture.whenStable();
    expect(buttonByText(host, 'Составить с ИИ').disabled).toBe(true);
    panel.generate();

    fixture.componentRef.setInput('ready', true);
    panel.prompt.setValue('x'.repeat(4_001));
    panel.generate();
    backend.expectNone('/api/teacher/ai/period-summary');
    expect(panel.prompt.touched).toBe(true);
  });
});
