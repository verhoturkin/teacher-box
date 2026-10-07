import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import { bodyText, buttonByText, hostElement, menuItemByText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { FileSaver } from '@shared/files/file-saver';
import { TextbookDialog } from './textbook-dialog';
import { TextbookToBoardDialog } from './textbook-to-board-dialog';
import { TextbooksPage } from './textbooks-page';

describe('TextbooksPage', () => {
  let fixture: ComponentFixture<TextbooksPage>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let saved: string[];

  async function render(textbooks = [aTextbook(), aWorkbook()]): Promise<void> {
    TestBed.configureTestingModule({ imports: [TextbooksPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    saved = [];
    vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, name) => {
      saved.push(name);
    });
    fixture = TestBed.createComponent(TextbooksPage);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/textbooks').flush(textbooks);
    backend
      .expectOne('/api/teacher/students')
      .flush([
        aStudent({ id: 's-1', displayName: 'Мария' }),
        aStudent({ id: 'gone', status: 'DEACTIVATED' }),
      ]);
    backend
      .expectOne('/api/teacher/groups')
      .flush([
        aGroup({ id: 'g-1', name: 'ОГЭ' }),
        aGroup({ id: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
      ]);
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

  it('lists textbooks one per row with their kind, course, file and members', async () => {
    await render();
    expect(host.querySelectorAll('ul.tb-list[aria-label="Учебники"] > li')).toHaveLength(2);
    const text = host.textContent;
    expect(text).toContain('Учебник · Английский · PDF, 120 с.');
    expect(text).toContain('Рабочая тетрадь · Word, 48 с.');
    expect(text).toContain('Мария, группа «ОГЭ»');
    expect(text).toContain('ученикам не открыт');

    requireButton('Скачать Spotlight 5').click();
    backend.expectOne('/api/teacher/textbooks/tb-1/file').flush(new Blob(['%PDF']));
    expect(saved).toEqual(['Spotlight 5.pdf']);
  });

  it('adds a textbook with the current students, groups and courses', async () => {
    await render([]);
    expect(host.textContent).toContain('Учебников пока нет');
    buttonByText(host, 'Новый учебник').click();
    await fixture.whenStable();
    expect(dialog().visible()).toBe(true);
    expect(dialog().textbook()).toBeNull();
    expect(dialog().students()).toEqual([{ id: 's-1', name: 'Мария' }]);
    expect(dialog().groups()).toEqual([{ id: 'g-1', name: 'ОГЭ' }]);

    dialog().saved.emit(aTextbook());
    backend
      .expectOne('/api/teacher/textbooks')
      .flush([aTextbook(), aWorkbook({ course: 'Алгебра' })]);
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
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/tb-1' }).flush(null);
    backend.expectOne('/api/teacher/textbooks').flush([aWorkbook()]);
    await fixture.whenStable();
    expect(host.querySelectorAll('ul.tb-list > li')).toHaveLength(1);
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
      value: [new File(['x'], 'скан.png')],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    const replace = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/tb-1/file' });
    replace.flush(aTextbook({ format: 'IMAGE' }));
    backend.expectOne('/api/teacher/textbooks').flush([aTextbook()]);
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Файл учебника «Spotlight 5» заменён');

    await openMenu('Spotlight 5');
    menuItemByText('Заменить файл').click();
    input.dispatchEvent(new Event('change'));
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
    await fixture.whenStable();
    expect(error).toHaveBeenCalledWith('Файл больше 100 МБ — портал его не примет.');
    backend.expectNone('/api/teacher/textbooks/tb-1/file');
  });
});
