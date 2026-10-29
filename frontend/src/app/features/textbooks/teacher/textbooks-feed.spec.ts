import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import { Textbook } from '../data-access/textbooks.models';
import {
  aFile,
  bodyText,
  buttonByText,
  hostElement,
  menuItemByText,
  settleFiles,
} from '@testing/dom';
import { testProviders, ConfirmHost } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { TextbookDialog } from './textbook-dialog';
import { TextbookToBoardDialog } from './textbook-to-board-dialog';
import { TextbooksFeed } from './textbooks-feed';

describe('TextbooksFeed', () => {
  let fixture: ComponentFixture<TextbooksFeed>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let saved: string[];

  /** Textbooks without a cover: the feed asks for none. */
  const plain = (): Textbook[] => [aTextbook({ hasCover: false }), aWorkbook({ hasCover: false })];

  async function render(textbooks = plain()): Promise<void> {
    TestBed.configureTestingModule({ imports: [TextbooksFeed], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    saved = [];
    vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, name) => {
      saved.push(name);
    });
    TestBed.createComponent(ConfirmHost).detectChanges();
    fixture = TestBed.createComponent(TextbooksFeed);
    fixture.componentRef.setInput('students', [{ id: 's-1', name: 'Мария' }]);
    fixture.componentRef.setInput('groups', [{ id: 'g-1', name: 'ОГЭ' }]);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/textbooks').flush(textbooks);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function dialog(): TextbookDialog {
    return fixture.debugElement.query(By.directive(TextbookDialog)).injector.get(TextbookDialog);
  }

  async function openMenu(title: string): Promise<void> {
    requireButton(`Действия: ${title}`).click();
    await fixture.whenStable();
  }

  function requireButton(label: string): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (button === null) throw new Error(`No button ${label}`);
    return button;
  }

  it('lists textbooks as cards with their kind, course, file and members', async () => {
    await render();
    expect(
      host.querySelectorAll('ul.tb-material-grid[aria-label="Список учебников"] > li'),
    ).toHaveLength(2);
    const text = host.textContent;
    expect(text).toContain('Учебник · Английский · PDF, 120 с.');
    expect(text).toContain('Рабочая тетрадь · Word, 48 с.');
    expect(text).toContain('Мария, группа «ОГЭ»');
    expect(text).toContain('ученикам не открыт');

    const open = vi.spyOn(TestBed.inject(FileOpener), 'open').mockImplementation(() => undefined);
    requireButton('Открыть Spotlight 5').click();
    expect(open).toHaveBeenCalledWith(expect.anything(), true, expect.any(Function));
    expect(open.mock.calls[0]?.[2](new Blob())).toBe('Spotlight 5.pdf');
    requireButton('Открыть Рабочая тетрадь').click();
    expect(open.mock.calls[1]?.[1]).toBe(false);
  });

  it('finds textbooks by title', async () => {
    await render();
    fixture.componentRef.setInput('query', 'ТЕТРАД');
    await fixture.whenStable();
    expect(host.querySelectorAll('ul.tb-material-grid > li')).toHaveLength(1);
    expect(host.textContent).toContain('Рабочая тетрадь');
    fixture.componentRef.setInput('query', 'алгебра');
    await fixture.whenStable();
    expect(host.textContent).toContain('Ничего не найдено');
  });

  it('adds a textbook with the current students, groups and courses', async () => {
    await render([]);
    expect(host.textContent).toContain('Учебников пока нет');
    fixture.componentInstance.openCreate();
    await fixture.whenStable();
    expect(dialog().visible()).toBe(true);
    expect(dialog().textbook()).toBeNull();
    expect(dialog().students()).toEqual([{ id: 's-1', name: 'Мария' }]);
    expect(dialog().groups()).toEqual([{ id: 'g-1', name: 'ОГЭ' }]);

    dialog().saved.emit(aTextbook());
    backend
      .expectOne('/api/teacher/textbooks')
      .flush([aTextbook({ hasCover: false }), aWorkbook({ hasCover: false, course: 'Алгебра' })]);
    await fixture.whenStable();
    expect(dialog().courses()).toEqual(['Алгебра', 'Английский']);
  });

  it('changes, downloads and deletes from the row menu', async () => {
    await render();
    await openMenu('Spotlight 5');
    menuItemByText('Изменить').click();
    await fixture.whenStable();
    expect(dialog().textbook()?.id).toBe('tb-1');

    await openMenu('Рабочая тетрадь');
    menuItemByText('Скачать').click();
    backend.expectOne('/api/teacher/textbooks/tb-2/file').flush(new Blob(['PK']));
    expect(saved).toEqual(['Тетрадь.docx']);

    await openMenu('Spotlight 5');
    menuItemByText('Удалить…').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('удалится вместе с файлом и пропадёт из заданий');
    buttonByText(document.body, 'Удалить').click();
    await fixture.whenStable();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/tb-1' }).flush(null);
    backend.expectOne('/api/teacher/textbooks').flush([aWorkbook({ hasCover: false })]);
    await fixture.whenStable();
    expect(host.querySelectorAll('ul.tb-material-grid > li')).toHaveLength(1);
  });

  it('puts a textbook on a board, but not a Word file', async () => {
    await render();
    await openMenu('Spotlight 5');
    menuItemByText('На доску').click();
    await fixture.whenStable();
    const board = fixture.debugElement
      .query(By.directive(TextbookToBoardDialog))
      .injector.get(TextbookToBoardDialog);
    expect(board.visible()).toBe(true);
    expect(board.textbook()?.id).toBe('tb-1');
    backend.expectOne('/api/teacher/boards').flush([]);
    board.visible.set(false);
    await fixture.whenStable();

    await openMenu('Рабочая тетрадь');
    expect(() => menuItemByText('На доску')).toThrow();
  });

  it('replaces the file of a textbook', async () => {
    await render();
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    const error = vi.spyOn(TestBed.inject(Snackbar), 'error');
    const input = host.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('No file input');
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    await openMenu('Spotlight 5');
    menuItemByText('Заменить файл').click();
    expect(click).toHaveBeenCalled();

    Object.defineProperty(input, 'files', {
      value: [aFile('скан.png')],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await settleFiles();
    const replace = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/tb-1/file' });
    replace.flush(aTextbook({ format: 'IMAGE' }));
    backend.expectOne('/api/teacher/textbooks').flush([aTextbook({ hasCover: false })]);
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Файл учебника «Spotlight 5» заменён');

    await openMenu('Spotlight 5');
    menuItemByText('Заменить файл').click();
    input.dispatchEvent(new Event('change'));
    await settleFiles();
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/tb-1/file' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Не удалось заменить файл'));
  });

  it('refuses a replacement over 100 MB and ignores an empty choice', async () => {
    await render();
    const error = vi.spyOn(TestBed.inject(Snackbar), 'error');
    const input = host.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('No file input');
    vi.spyOn(input, 'click').mockImplementation(() => undefined);
    input.dispatchEvent(new Event('change'));

    await openMenu('Spotlight 5');
    menuItemByText('Заменить файл').click();
    const huge = new File(['x'], 'big.pdf');
    Object.defineProperty(huge, 'size', { value: 101 * 1024 * 1024 });
    Object.defineProperty(input, 'files', { value: [huge], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settleFiles();
    expect(error).toHaveBeenCalledWith('«big.pdf» больше 100 МБ');
    backend.expectNone('/api/teacher/textbooks/tb-1/file');
  });

  it('filters by kind and by the search over the course, and sorts', async () => {
    await render([
      aTextbook({ hasCover: false }),
      aWorkbook({
        hasCover: false,
        members: [],
        title: 'Альфа',
        updatedAt: '2026-10-05T10:00:00Z',
      }),
    ]);
    const titles = (): string[] =>
      [...host.querySelectorAll('.tb-material-card__title')].map((link) => link.textContent.trim());
    // the latest change first
    expect(titles()).toEqual(['Альфа', 'Spotlight 5']);

    fixture.componentRef.setInput('sort', 'title');
    await fixture.whenStable();
    expect(titles()).toEqual(['Альфа', 'Spotlight 5']);
    fixture.componentRef.setInput('sort', 'created');
    await fixture.whenStable();
    expect(titles()).toHaveLength(2);

    fixture.componentRef.setInput('filter', 'WORKBOOK');
    await fixture.whenStable();
    expect(titles()).toEqual(['Альфа']);
    fixture.componentRef.setInput('filter', 'all');
    fixture.componentRef.setInput('query', 'английский');
    await fixture.whenStable();
    expect(titles()).toEqual(['Spotlight 5']);
    fixture.componentRef.setInput('query', 'мария');
    await fixture.whenStable();
    expect(titles()).toEqual(['Spotlight 5']);
    expect(fixture.componentInstance.total()).toBe(2);
  });

  it('shows the cover of a textbook that has one', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cover');
    await render([aTextbook()]);
    backend.expectOne('/api/teacher/textbooks/tb-1/cover').flush(new Blob(['png']));
    await fixture.whenStable();

    expect(created).toHaveBeenCalled();
    expect(host.querySelector('.tb-material-card img')?.getAttribute('src')).toBe('blob:cover');
  });
});
