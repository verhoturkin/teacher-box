import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { systemPrompt } from '@testing/ai-fixtures';
import { bodyText, buttonByText, hostElement, menuItemByText, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { SystemPromptsCard } from './system-prompts-card';

describe('SystemPromptsCard', () => {
  let fixture: ComponentFixture<SystemPromptsCard>;
  let backend: HttpTestingController;

  const review = systemPrompt({
    feature: 'REVIEW_DRAFT',
    text: 'Проверяй строго',
    defaultText: 'Ты помогаешь репетитору проверять домашние работы.',
    custom: true,
    updatedAt: '2026-10-13T10:00:00Z',
    version: 2,
  });

  async function render() {
    TestBed.configureTestingModule({ imports: [SystemPromptsCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(SystemPromptsCard);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/system-prompts').flush([systemPrompt(), review]);
    await fixture.whenStable();
    return { card: fixture.componentInstance, host: hostElement(fixture) };
  }

  function button(host: HTMLElement, label: string): HTMLButtonElement {
    const found = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (found === null) {
      throw new Error(`no button «${label}»`);
    }
    return found;
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('shows both prompts and marks the changed one', async () => {
    const { host } = await render();

    const text = readableText(host);
    expect(text).toContain('Черновик задания Ты помогаешь репетитору готовить домашние задания.');
    expect(text).toContain('Черновик проверки Изменён Проверяй строго');
    expect(text.match(/Изменён/g)).toHaveLength(1);
  });

  it('saves the rewritten standard prompt', async () => {
    const { card, host } = await render();

    button(host, 'Изменить системный промт «Черновик задания»').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Формат ответа портал задаёт сам');
    expect(() => buttonByText(document.body, 'Другие действия')).toThrow();
    card.form.controls.text.setValue('  ');
    buttonByText(document.body, 'Сохранить').click();
    backend.expectNone('/api/teacher/ai/system-prompts/HOMEWORK_DRAFT');

    card.form.controls.text.setValue('  Пиши кратко ');
    buttonByText(document.body, 'Сохранить').click();
    const update = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/ai/system-prompts/HOMEWORK_DRAFT',
    });
    expect(update.request.body).toEqual({ text: 'Пиши кратко', version: 0 });
    update.flush(
      systemPrompt({
        text: 'Пиши кратко',
        custom: true,
        updatedAt: '2026-10-13T11:00:00Z',
        version: 1,
      }),
    );
    await fixture.whenStable();

    expect(card.visible()).toBe(false);
    expect(readableText(host)).toContain('Черновик задания Изменён Пиши кратко');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });

  it('keeps the dialog open when saving fails', async () => {
    const { card } = await render();

    card.edit(review);
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/ai/system-prompts/REVIEW_DRAFT' })
      .flush({ status: 409, code: 'conflict' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(card.visible()).toBe(true);
    buttonByText(document.body, 'Отмена').click();
    expect(card.visible()).toBe(false);
  });

  it('restores the standard prompt after a confirmation', async () => {
    const { card, host } = await render();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((request) => {
      request.accept?.();
      return confirmation;
    });

    button(host, 'Изменить системный промт «Черновик проверки»').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();
    menuItemByText('Вернуть стандартный').click();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/ai/system-prompts/REVIEW_DRAFT' })
      .flush({ ...review, text: review.defaultText, custom: false, updatedAt: null, version: 0 });
    await fixture.whenStable();

    expect(card.visible()).toBe(false);
    expect(readableText(host)).not.toContain('Изменён');
    expect(readableText(host)).toContain('Ты помогаешь репетитору проверять домашние работы.');
  });

  it('keeps the dialog open when restoring fails', async () => {
    const { card } = await render();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((request) => {
      request.accept?.();
      return confirmation;
    });

    card.edit(review);
    await fixture.whenStable();
    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();
    menuItemByText('Вернуть стандартный').click();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/ai/system-prompts/REVIEW_DRAFT' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(card.visible()).toBe(true);
  });
});
