import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { attachment, submission } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { Attachment, InteractiveResult } from '../data-access/homework.models';
import { AttachmentList } from './attachment-list';
import { FilePicker } from './file-picker';
import { INTERACTIVE_PAGE_PATH, InteractiveFrame, interactiveResult } from './interactive-frame';
import { SubmissionList } from './submission-list';
import { TaskStatusTag } from './task-status-tag';

describe('AttachmentList', () => {
  it('lists files with download and optional removal', async () => {
    TestBed.configureTestingModule({ imports: [AttachmentList], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(AttachmentList);
    const downloaded: Attachment[] = [];
    const removed: Attachment[] = [];
    fixture.componentInstance.download.subscribe((file) => downloaded.push(file));
    fixture.componentInstance.remove.subscribe((file) => removed.push(file));
    fixture.componentRef.setInput('attachments', [attachment()]);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('условие.pdf 2,5 КБ');
    expect(host.querySelector('[aria-label="Удалить файл условие.pdf"]')).toBeNull();
    buttonByText(host, 'условие.pdf').click();
    expect(downloaded.map((file) => file.id)).toEqual(['f-1']);

    fixture.componentRef.setInput('removable', true);
    await fixture.whenStable();
    buttonByText(host, 'Удалить файл условие.pdf').click();
    expect(removed.map((file) => file.id)).toEqual(['f-1']);
  });

  it('renders nothing without files', async () => {
    TestBed.configureTestingModule({ imports: [AttachmentList] });
    const fixture = TestBed.createComponent(AttachmentList);
    fixture.componentRef.setInput('attachments', []);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelector('ul')).toBeNull();
  });
});

@Component({
  selector: 'tb-picker-host',
  imports: [FilePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-file-picker [(files)]="files" />`,
})
class PickerHost {
  readonly files = signal<File[]>([]);
}

describe('FilePicker', () => {
  it('collects selected files and lets remove them', async () => {
    TestBed.configureTestingModule({ imports: [PickerHost], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const input = requireElement(host, 'input[type="file"]', HTMLInputElement);
    const clicks = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    expect(input.accept).toContain('.pdf');

    buttonByText(host, 'Прикрепить файлы').click();
    expect(clicks).toHaveBeenCalled();

    const files = [new File(['a'], 'a.txt'), new File(['bb'], 'b.png')];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(fixture.componentInstance.files().map((file) => file.name)).toEqual(['a.txt', 'b.png']);
    expect(readableText(host)).toContain('a.txt 1 Б');

    buttonByText(host, 'Убрать a.txt').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.files().map((file) => file.name)).toEqual(['b.png']);
  });
});

describe('SubmissionList and TaskStatusTag', () => {
  it('shows attempts newest first and downloads files', async () => {
    TestBed.configureTestingModule({ imports: [SubmissionList], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(SubmissionList);
    const downloaded: Attachment[] = [];
    fixture.componentInstance.download.subscribe((file) => downloaded.push(file));
    fixture.componentRef.setInput('submissions', [
      submission({ id: 'new' }),
      submission({ id: 'old', text: null, attachments: [] }),
    ]);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Последний ответ');
    expect(readableText(host)).toContain('Предыдущий ответ');
    expect(host.querySelectorAll('.tb-submission--old')).toHaveLength(1);
    buttonByText(host, 'решение.jpg').click();
    expect(downloaded.map((file) => file.id)).toEqual(['f-2']);
  });

  it('shows «Готово» and what an interactive page reported', async () => {
    TestBed.configureTestingModule({ imports: [SubmissionList], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(SubmissionList);
    fixture.componentRef.setInput('submissions', [
      submission({
        id: 'page',
        text: null,
        attachments: [],
        result: {
          score: 1,
          maxScore: 3,
          answers: [
            { question: '2 + 2', answer: '4', correct: true },
            { question: '3 · 3', answer: '6', correct: false },
            { question: 'Ваше мнение', answer: null, correct: null },
          ],
        },
      }),
      submission({ id: 'board', text: null, attachments: [] }),
    ]);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Результат страницы: 1 из 3');
    const answers = Array.from(host.querySelectorAll('.tb-page-answers li')).map(readableText);
    expect(answers).toEqual(['2 + 2 — 4 верно', '3 · 3 — 6 неверно', 'Ваше мнение — нет ответа']);
    expect(host.querySelectorAll('.tb-submission')[1]?.textContent).toContain('Отмечено «Готово»');
  });

  it('shows an empty state', async () => {
    TestBed.configureTestingModule({ imports: [SubmissionList] });
    const fixture = TestBed.createComponent(SubmissionList);
    fixture.componentRef.setInput('submissions', []);
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toBe('Ответов пока нет');
  });

  it('marks overdue tasks and shows the grade', async () => {
    TestBed.configureTestingModule({ imports: [TaskStatusTag], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(TaskStatusTag);
    fixture.componentRef.setInput('status', 'RETURNED');
    fixture.componentRef.setInput('overdue', true);
    fixture.componentRef.setInput('grade', '4');
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toBe('На доработке Просрочено Оценка: 4');
  });
});

describe('InteractiveFrame', () => {
  async function render(url = `${INTERACTIVE_PAGE_PATH}token`) {
    TestBed.configureTestingModule({ imports: [InteractiveFrame] });
    const fixture = TestBed.createComponent(InteractiveFrame);
    const results: InteractiveResult[] = [];
    fixture.componentInstance.result.subscribe((result) => results.push(result));
    fixture.componentRef.setInput('url', url);
    fixture.componentRef.setInput('title', 'Страница задания');
    await fixture.whenStable();
    return { fixture, results, host: hostElement(fixture) };
  }

  function send(source: MessageEventSource | null, data: unknown): void {
    window.dispatchEvent(new MessageEvent('message', { data, source }));
  }

  it('frames the page in a sandbox and listens only to it', async () => {
    const { fixture, results, host } = await render();
    const page = requireElement(host, 'iframe', HTMLIFrameElement);

    expect(page.getAttribute('sandbox')).toBe('allow-scripts');
    expect(page.getAttribute('src')).toBe('/api/public/homework/interactive/token');
    expect(page.title).toBe('Страница задания');

    send(page.contentWindow, { type: 'teacherbox:height', height: 900.4 });
    send(page.contentWindow, { type: 'teacherbox:result', result: { score: 2, maxScore: 3 } });
    send(window, { type: 'teacherbox:result', result: { score: 3, maxScore: 3 } });
    send(page.contentWindow, { type: 'teacherbox:result', result: 'полный балл' });
    send(page.contentWindow, 'teacherbox:height');
    send(page.contentWindow, { type: 'other' });
    await fixture.whenStable();

    expect(page.style.height).toBe('900px');
    expect(results).toEqual([{ score: 2, maxScore: 3, answers: [] }]);

    send(page.contentWindow, { type: 'teacherbox:height', height: 10 });
    await fixture.whenStable();
    expect(page.style.height).toBe('160px');

    fixture.destroy();
    send(page.contentWindow, { type: 'teacherbox:result', result: { score: 1, maxScore: 3 } });
    expect(results).toHaveLength(1);
  });

  it('frames nothing but the pages of homework', async () => {
    const { host } = await render('https://example.com/');

    expect(host.querySelector('iframe')).toBeNull();
  });

  it('brings a reported result to the limits of the backend', () => {
    expect(interactiveResult(null)).toBeNull();
    expect(interactiveResult([1])).toBeNull();
    expect(interactiveResult({ score: 5, maxScore: 3 })).toEqual({
      score: null,
      maxScore: null,
      answers: [],
    });
    expect(interactiveResult({ score: 1.5, maxScore: 3 })?.score).toBeNull();
    expect(interactiveResult({ score: 0, maxScore: 3 })?.score).toBe(0);
    expect(
      interactiveResult({
        answers: [
          { question: 'Сколько?', answer: 4, correct: 'да' },
          { question: ' ', answer: '1' },
          { answer: 'без вопроса' },
          'просто строка',
          { question: 'q'.repeat(600), answer: { value: 1 }, correct: false },
          { question: 'Да?', answer: true },
        ],
      }),
    ).toEqual({
      score: null,
      maxScore: null,
      answers: [
        { question: 'Сколько?', answer: '4', correct: null },
        { question: 'q'.repeat(500), answer: null, correct: false },
        { question: 'Да?', answer: 'true', correct: null },
      ],
    });
    const many = Array.from({ length: 150 }, (_, index) => ({ question: String(index) }));
    expect(interactiveResult({ answers: many })?.answers).toHaveLength(100);
  });
});
