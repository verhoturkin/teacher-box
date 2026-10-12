import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { savedPrompt } from '@testing/ai-fixtures';
import { bodyText, buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { PromptLibraryCard } from './prompt-library-card';

describe('PromptLibraryCard', () => {
  let fixture: ComponentFixture<PromptLibraryCard>;
  let backend: HttpTestingController;

  async function render(
    prompts = [savedPrompt(), savedPrompt({ id: 'p-2', title: 'Перевод', text: 'Переведи текст' })],
  ) {
    TestBed.configureTestingModule({ imports: [PromptLibraryCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MessageService), 'add');
    fixture = TestBed.createComponent(PromptLibraryCard);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/ai/prompts').flush(prompts);
    await fixture.whenStable();
    return { card: fixture.componentInstance, host: hostElement(fixture) };
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('lists the prompts with their texts', async () => {
    const { host } = await render();

    expect(readableText(host)).toContain('Тест на 10 вопросов Сделай тест на 10 вопросов');
    expect(readableText(host)).toContain('Перевод Переведи текст');
  });

  it('says when the library is empty', async () => {
    const { host } = await render([]);

    expect(readableText(host)).toContain('Промтов пока нет');
  });

  it('changes a prompt', async () => {
    const { card, host } = await render();

    host.querySelector<HTMLButtonElement>('button[aria-label="Изменить промт «Перевод»"]')?.click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Промт');
    card.form.patchValue({ title: ' ' });
    card.save();
    backend.expectNone('/api/teacher/ai/prompts/p-2');

    card.form.patchValue({ title: 'Аудирование' });
    buttonByText(document.body, 'Сохранить').click();
    const update = backend.expectOne({ method: 'PUT', url: '/api/teacher/ai/prompts/p-2' });
    expect(update.request.body).toMatchObject({ title: 'Аудирование', version: 0 });
    update.flush(
      savedPrompt({ id: 'p-2', title: 'Аудирование', text: 'Переведи текст', version: 1 }),
    );
    await fixture.whenStable();
    expect(card.editing()).toBeNull();
    expect(readableText(host)).toContain('Аудирование Переведи текст');

    card.edit(savedPrompt());
    card.save();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/ai/prompts/p-1' })
      .flush({ status: 409, code: 'conflict' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(card.editing()).not.toBeNull();
    buttonByText(document.body, 'Отмена').click();
    expect(card.editing()).toBeNull();
  });

  it('deletes a prompt after a confirmation', async () => {
    const { host } = await render();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((request) => {
      request.accept?.();
      return confirmation;
    });

    host.querySelector<HTMLButtonElement>('button[aria-label="Удалить промт «Перевод»"]')?.click();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/ai/prompts/p-2' }).flush(null);
    await fixture.whenStable();

    expect(readableText(host)).not.toContain('Перевод');
    expect(TestBed.inject(MessageService).add).toHaveBeenCalled();
  });
});
