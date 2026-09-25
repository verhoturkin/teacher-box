import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText } from '@testing/dom';
import { HomeworkDraft } from './data-access/ai.models';
import { HomeworkDraftDialog } from './homework-draft-dialog';

describe('HomeworkDraftDialog', () => {
  let fixture: ComponentFixture<HomeworkDraftDialog>;
  let backend: HttpTestingController;
  let drafts: HomeworkDraft[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HomeworkDraftDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomeworkDraftDialog);
    drafts = [];
    fixture.componentInstance.generated.subscribe((draft) => drafts.push(draft));
    fixture.componentRef.setInput('topic', 'Дроби');
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('prefills the topic and generates a draft', async () => {
    const dialog = fixture.componentInstance;
    expect(dialog.form.controls.topic.value).toBe('Дроби');
    dialog.form.patchValue({ level: ' 6 класс ', taskCount: 4, wishes: ' без картинок ' });
    await fixture.whenStable();

    buttonByText(document.body, 'Сгенерировать').click();
    const request = backend.expectOne('/api/teacher/ai/homework-draft');
    expect(request.request.body).toEqual({ topic: 'Дроби', level: '6 класс', taskCount: 4, wishes: 'без картинок' });
    request.flush({ title: 'Сложение дробей', description: '1. ...' });
    await fixture.whenStable();

    expect(drafts).toEqual([{ title: 'Сложение дробей', description: '1. ...' }]);
    expect(dialog.visible()).toBe(false);
  });

  it('sends empty optional fields as null', () => {
    fixture.componentInstance.generate();

    expect(backend.expectOne('/api/teacher/ai/homework-draft').request.body).toEqual({
      topic: 'Дроби',
      level: null,
      taskCount: 5,
      wishes: null,
    });
  });

  it('requires a topic and a task count', () => {
    fixture.componentInstance.form.patchValue({ topic: '' });
    fixture.componentInstance.generate();
    fixture.componentInstance.form.patchValue({ topic: 'Дроби', taskCount: null });
    fixture.componentInstance.generate();

    backend.expectNone('/api/teacher/ai/homework-draft');
  });

  it('explains errors and keeps the dialog open', async () => {
    fixture.componentInstance.generate();
    backend
      .expectOne('/api/teacher/ai/homework-draft')
      .flush({ status: 422, code: 'ai.limit-exceeded' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Исчерпан месячный лимит токенов ИИ');
    expect(fixture.componentInstance.visible()).toBe(true);

    buttonByText(document.body, 'Отмена').click();
    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
