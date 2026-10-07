import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { bodyText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BoardClipboard } from './board-clipboard';
import { BoardInsert } from './board-insert';
import { ToBoardDialog } from './to-board-dialog';

describe('ToBoardDialog', () => {
  let fixture: ComponentFixture<ToBoardDialog>;
  let backend: HttpTestingController;
  let clipboard: BoardClipboard;
  let insert: BoardInsert;
  let open: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToBoardDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    clipboard = TestBed.inject(BoardClipboard);
    insert = TestBed.inject(BoardInsert);
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
    vi.restoreAllMocks();
  });

  async function show(rich = true): Promise<ToBoardDialog> {
    vi.spyOn(clipboard, 'canWriteRich').mockReturnValue(rich);
    fixture = TestBed.createComponent(ToBoardDialog);
    fixture.componentRef.setInput('title', 'Дроби');
    fixture.componentRef.setInput('markdown', 'Решите');
    fixture.componentRef.setInput('ownerIds', ['group-1']);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('opens an Excalidraw board with the material on it', async () => {
    const dialog = await show();
    backend.expectOne('/api/teacher/boards').flush([aBoard({ title: 'Физика' })]);
    await fixture.whenStable();
    const put = vi.spyOn(insert, 'put');

    expect(bodyText()).toContain('материал появится в центре');
    await dialog.place('image');
    await fixture.whenStable();

    expect(put).toHaveBeenCalledWith('board-1', {
      title: 'Дроби',
      markdown: 'Решите',
      mode: 'image',
    });
    expect(open).toHaveBeenCalledWith('/teacher/boards/board-1', '_blank', 'noopener');
    expect(bodyText()).toContain('материал уже на ней');
    expect(bodyText()).toContain('Открыть доску «Физика»');
  });

  it('copies the material for an external board and opens it, its students first', async () => {
    const dialog = await show();
    backend.expectOne('/api/teacher/boards').flush([aBoard(), aLinkBoard()]);
    await fixture.whenStable();

    const labels = Array.from(document.body.querySelectorAll('.tb-to-board label')).map(
      (label) => label.textContent,
    );
    expect(labels[0]).toContain('Холст');
    expect(labels[0]).toContain('Внешняя доска, группа «ОГЭ»');
    expect(dialog.chosen()).toBe('board-2');
    expect(bodyText()).toContain('нажмите на ней Ctrl+V');
    const copyText = vi.spyOn(clipboard, 'copyText').mockResolvedValue();

    await dialog.place('text');
    await fixture.whenStable();

    expect(copyText).toHaveBeenCalledWith('Дроби', 'Решите');
    expect(open).toHaveBeenCalledWith('https://app.holst.so/board/1', '_blank', 'noopener');
    expect(bodyText()).toContain('Текст в буфере обмена');
  });

  it('copies a picture for an external board', async () => {
    const dialog = await show();
    backend.expectOne('/api/teacher/boards').flush([aLinkBoard()]);
    await fixture.whenStable();
    const copyImage = vi.spyOn(clipboard, 'copyImage').mockResolvedValue();

    await dialog.place('image');
    await fixture.whenStable();

    expect(copyImage).toHaveBeenCalledWith('Дроби', 'Решите');
    expect(bodyText()).toContain('Картинка в буфере обмена');
  });

  it('explains when the browser refuses to copy', async () => {
    const dialog = await show(false);
    backend.expectOne('/api/teacher/boards').flush([aLinkBoard()]);
    await fixture.whenStable();
    expect(bodyText()).toContain('только когда портал открыт по https');
    vi.spyOn(clipboard, 'copyText').mockRejectedValue(new Error('denied'));

    await dialog.place('text');
    await fixture.whenStable();

    expect(bodyText()).toContain('Браузер не дал скопировать материал');
    expect(open).not.toHaveBeenCalled();
  });

  it('tells where to create boards when there are none', async () => {
    const dialog = await show();
    backend.expectOne('/api/teacher/boards').flush([]);
    await fixture.whenStable();

    expect(bodyText()).toContain('Создайте доску в разделе «Доски»');
    await dialog.place('text');
    expect(open).not.toHaveBeenCalled();
  });

  it('puts pages of a textbook only on an Excalidraw board', async () => {
    vi.spyOn(clipboard, 'canWriteRich').mockReturnValue(true);
    fixture = TestBed.createComponent(ToBoardDialog);
    const material = {
      title: 'Spotlight 5, с. 2-3',
      mode: 'pages' as const,
      pictures: ['/api/teacher/textbooks/tb-1/pages/2'],
    };
    fixture.componentRef.setInput('pages', material);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/boards').flush([aLinkBoard(), aBoard({ title: 'Физика' })]);
    await fixture.whenStable();
    const put = vi.spyOn(insert, 'put');

    expect(bodyText()).toContain('страницы появятся в центре');
    expect(bodyText()).not.toContain('Холст');
    expect(bodyText()).not.toContain('Текстом');
    fixture.componentInstance.placePages(material);
    await fixture.whenStable();

    expect(put).toHaveBeenCalledWith('board-1', material);
    expect(open).toHaveBeenCalledWith('/teacher/boards/board-1', '_blank', 'noopener');
    expect(bodyText()).toContain('страницы уже на ней');
  });

  it('says when there is no Excalidraw board for the pages', async () => {
    vi.spyOn(clipboard, 'canWriteRich').mockReturnValue(true);
    fixture = TestBed.createComponent(ToBoardDialog);
    const material = { title: 'Скан', mode: 'pages' as const, pictures: [] };
    fixture.componentRef.setInput('pages', material);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/boards').flush([aLinkBoard()]);
    await fixture.whenStable();

    expect(bodyText()).toContain('Досок Excalidraw пока нет');
    fixture.componentInstance.placePages(material);
    expect(open).not.toHaveBeenCalled();
  });
});
