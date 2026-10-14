import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { attachment, submission } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { FileOpener } from '@shared/files/file-opener';
import { Attachment } from '../data-access/homework.models';
import { AttachmentList } from './attachment-list';
import { FilePicker } from './file-picker';
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

  it('opens a file by its name and downloads it by the button when openable', async () => {
    TestBed.configureTestingModule({ imports: [AttachmentList], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(AttachmentList);
    const opened: Attachment[] = [];
    const downloaded: Attachment[] = [];
    fixture.componentInstance.opened.subscribe((file) => opened.push(file));
    fixture.componentInstance.download.subscribe((file) => downloaded.push(file));
    fixture.componentRef.setInput('attachments', [attachment()]);
    fixture.componentRef.setInput('openable', true);
    await fixture.whenStable();
    const host = hostElement(fixture);

    buttonByText(host, 'Открыть условие.pdf').click();
    buttonByText(host, 'Скачать условие.pdf').click();
    expect(opened.map((file) => file.id)).toEqual(['f-1']);
    expect(downloaded.map((file) => file.id)).toEqual(['f-1']);
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
  it('shows picked files as cards; a PDF or a picture opens by its name', async () => {
    TestBed.configureTestingModule({ imports: [PickerHost], providers: [providePrimeNG()] });
    const opened: string[] = [];
    vi.spyOn(TestBed.inject(FileOpener), 'open').mockImplementation((content, _showable, name) => {
      content.subscribe((blob) => opened.push(name(blob)));
    });
    const fixture = TestBed.createComponent(PickerHost);
    fixture.componentInstance.files.set([
      new File(['%PDF'], 'условие.pdf', { type: 'application/pdf' }),
      new File(['a'], 'a.txt', { type: 'text/plain' }),
    ]);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(host.querySelectorAll('.tb-list > li')).toHaveLength(2);
    expect(host.querySelector('.tb-i-picture_as_pdf')).not.toBeNull();
    buttonByText(host, 'Открыть условие.pdf').click();
    expect(opened).toEqual(['условие.pdf']);
    expect(host.querySelector('[aria-label="Открыть a.txt"]')).toBeNull();
  });

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
