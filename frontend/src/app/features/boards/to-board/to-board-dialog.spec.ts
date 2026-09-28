import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aBoard } from '@testing/boards-fixtures';
import { bodyText } from '@testing/dom';
import { BoardClipboard } from './board-clipboard';
import { ToBoardDialog } from './to-board-dialog';
import { testProviders } from '@testing/setup';

describe('ToBoardDialog', () => {
  let fixture: ComponentFixture<ToBoardDialog>;
  let backend: HttpTestingController;
  let clipboard: BoardClipboard;
  let open: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToBoardDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    clipboard = TestBed.inject(BoardClipboard);
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
    fixture.componentRef.setInput('ownerIds', ['student-2']);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('copies the material as text and opens the board', async () => {
    const dialog = await show();
    const mine = aBoard({
      id: 'board-2',
      ownerId: 'student-2',
      ownerName: 'Иван',
      title: 'Физика',
      url: 'https://app.holst.so/board/2',
    });
    backend.expectOne('/api/teacher/boards').flush([aBoard(), mine]);
    await fixture.whenStable();

    const labels = Array.from(document.body.querySelectorAll('.tb-to-board label')).map(
      (label) => label.textContent,
    );
    expect(labels[0]).toContain('Физика');
    expect(labels[1]).toContain('Алгебра');
    expect(dialog.chosen()).toBe('board-2');
    const copyText = vi.spyOn(clipboard, 'copyText').mockResolvedValue();

    await dialog.copy('text');
    await fixture.whenStable();

    expect(copyText).toHaveBeenCalledWith('Дроби', 'Решите');
    expect(open).toHaveBeenCalledWith('https://app.holst.so/board/2', '_blank', 'noopener');
    expect(bodyText()).toContain('Текст в буфере обмена');
    expect(bodyText()).toContain('Открыть доску «Физика»');
  });

  it('copies a picture to the chosen board', async () => {
    const dialog = await show();
    backend
      .expectOne('/api/teacher/boards')
      .flush([aBoard(), aBoard({ id: 'board-2', title: 'Физика' })]);
    await fixture.whenStable();
    const copyImage = vi.spyOn(clipboard, 'copyImage').mockResolvedValue();

    dialog.chosen.set('board-2');
    await dialog.copy('image');
    await fixture.whenStable();

    expect(copyImage).toHaveBeenCalledWith('Дроби', 'Решите');
    expect(bodyText()).toContain('Картинка в буфере обмена');
  });

  it('explains when the browser refuses to copy', async () => {
    const dialog = await show(false);
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);
    await fixture.whenStable();
    expect(bodyText()).toContain('только когда портал открыт по https');
    vi.spyOn(clipboard, 'copyText').mockRejectedValue(new Error('denied'));

    await dialog.copy('text');
    await fixture.whenStable();

    expect(bodyText()).toContain('Браузер не дал скопировать материал');
    expect(open).not.toHaveBeenCalled();
  });

  it('tells where to add boards when there are none', async () => {
    const dialog = await show();
    backend.expectOne('/api/teacher/boards').flush([]);
    await fixture.whenStable();

    expect(bodyText()).toContain('Досок пока нет');
    await dialog.copy('text');
    expect(open).not.toHaveBeenCalled();
  });
});
