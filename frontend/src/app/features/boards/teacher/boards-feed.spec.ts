import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { aBoard, aLinkBoard } from '@testing/boards-fixtures';
import { bodyText, buttonByText, hostElement, menuItemByText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BoardBackupsDialog } from './board-backups-dialog';
import { BoardDialog } from './board-dialog';
import { BoardsFeed } from './boards-feed';

describe('BoardsFeed', () => {
  let fixture: ComponentFixture<BoardsFeed>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(inputs: { student?: string; group?: string } = {}): Promise<void> {
    TestBed.configureTestingModule({ imports: [BoardsFeed], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BoardsFeed);
    fixture.componentRef.setInput('students', [{ id: 's-1', name: 'Мария' }]);
    fixture.componentRef.setInput('groups', [{ id: 'g-1', name: 'ОГЭ' }]);
    if (inputs.student) fixture.componentRef.setInput('student', inputs.student);
    if (inputs.group) fixture.componentRef.setInput('group', inputs.group);
    fixture.detectChanges();
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  function titles(): string[] {
    return [...host.querySelectorAll('.tb-material-card__title')].map((link) =>
      link.textContent.trim(),
    );
  }

  it('lists the boards as cards: a portal board opens in the editor, an external one by its link with the service tag', async () => {
    await render();
    backend
      .expectOne('/api/teacher/boards')
      .flush([aBoard(), aLinkBoard({ updatedAt: '2026-10-03T10:00:00Z' })]);
    await fixture.whenStable();

    const cards = host.querySelectorAll('ul.tb-material-grid[aria-label="Список досок"] > li');
    expect(cards).toHaveLength(2);
    const portal = cards[1]?.querySelector('a.tb-material-card__title');
    const external = cards[0]?.querySelector('a.tb-material-card__title');
    expect(portal?.getAttribute('href')).toBe('/teacher/boards/board-1');
    expect(external?.getAttribute('href')).toBe('https://app.holst.so/board/1');
    expect(external?.getAttribute('target')).toBe('_blank');
    expect(host.querySelector('.tb-material-card__tag')?.textContent).toContain('Холст');
    expect(host.textContent).toContain('группа «ОГЭ»');
    expect(host.textContent).toContain('Мария · 02.10');
    expect(fixture.componentInstance.total()).toBe(2);
  });

  it('shows the preview of a board that has one and the icon of a board that has none', async () => {
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    await render();
    backend
      .expectOne('/api/teacher/boards')
      .flush([aBoard({ previewUpdatedAt: '2026-10-02T10:00:00Z' }), aBoard({ id: 'b-2' })]);
    await fixture.whenStable();
    backend
      .expectOne((request) => request.url === '/api/boards/board-1/preview')
      .flush(new Blob(['png']));
    await fixture.whenStable();

    expect(created).toHaveBeenCalled();
    expect(host.querySelectorAll('.tb-material-card img')).toHaveLength(1);
    expect(host.querySelectorAll('.tb-material-card .tb-i-co_present')).toHaveLength(1);
  });

  it('filters the portal boards and the external ones, searches by the title or a student’s or group’s name and sorts', async () => {
    await render();
    backend.expectOne('/api/teacher/boards').flush([
      aBoard(),
      aBoard({
        id: 'board-3',
        title: 'Геометрия',
        members: [],
        updatedAt: '2026-10-05T10:00:00Z',
      }),
      aLinkBoard({ updatedAt: '2026-10-03T10:00:00Z' }),
    ]);
    await fixture.whenStable();
    // the latest change first
    expect(titles()).toEqual(['Геометрия', 'Холст', 'Алгебра']);

    fixture.componentRef.setInput('filter', 'portal');
    await fixture.whenStable();
    expect(titles()).toEqual(['Геометрия', 'Алгебра']);
    fixture.componentRef.setInput('filter', 'external');
    await fixture.whenStable();
    expect(titles()).toEqual(['Холст']);
    fixture.componentRef.setInput('filter', 'all');

    fixture.componentRef.setInput('query', 'мари');
    await fixture.whenStable();
    expect(titles()).toEqual(['Алгебра']);
    fixture.componentRef.setInput('query', 'огэ');
    await fixture.whenStable();
    expect(titles()).toEqual(['Холст']);
    fixture.componentRef.setInput('query', 'нет такой');
    await fixture.whenStable();
    expect(titles()).toEqual([]);
    expect(host.textContent).toContain('Ничего не найдено');

    fixture.componentRef.setInput('query', '');
    fixture.componentRef.setInput('sort', 'title');
    await fixture.whenStable();
    expect(titles()).toEqual(['Алгебра', 'Геометрия', 'Холст']);
  });

  it('opens the form of a new board', async () => {
    await render();
    backend.expectOne('/api/teacher/boards').flush([]);
    await fixture.whenStable();
    expect(host.textContent).toContain('Досок пока нет');

    fixture.componentInstance.openCreate();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(BoardDialog)).injector.get(BoardDialog);
    expect(dialog.visible()).toBe(true);
    expect(dialog.board()).toBeNull();
  });

  it('asks the server for the boards of a student and creates a board for them', async () => {
    await render({ student: 's-1' });
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);
    await fixture.whenStable();
    expect(host.textContent).toContain('У них досок пока нет');

    fixture.componentInstance.openCreate();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(BoardDialog)).injector.get(BoardDialog);
    expect(dialog.defaults()).toEqual({ studentIds: ['s-1'], groupIds: [] });
    expect(dialog.students()).toEqual([{ id: 's-1', name: 'Мария' }]);
    expect(dialog.groups()).toEqual([{ id: 'g-1', name: 'ОГЭ' }]);

    dialog.saved.emit(aBoard());
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([aBoard()]);
    await fixture.whenStable();
    expect(titles()).toEqual(['Алгебра']);
  });

  it('asks the server for the boards of a group', async () => {
    await render({ group: 'g-1' });
    backend.expectOne('/api/teacher/boards?groupId=g-1').flush([aLinkBoard()]);
    await fixture.whenStable();

    expect(titles()).toEqual(['Холст']);
    fixture.componentRef.setInput('group', undefined);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/boards').flush([]);
  });

  it('edits a board, opens its copies and deletes it after a confirmation', async () => {
    await render();
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);
    await fixture.whenStable();

    expect(buttonByText(host, 'Действия: Алгебра').getAttribute('aria-haspopup')).toBe('menu');
    await act('Алгебра', 'Изменить');
    const dialog = fixture.debugElement.query(By.directive(BoardDialog)).injector.get(BoardDialog);
    expect(dialog.board()).toEqual(aBoard());

    await act('Алгебра', 'Резервные копии');
    const backups = fixture.debugElement
      .query(By.directive(BoardBackupsDialog))
      .injector.get(BoardBackupsDialog);
    expect(backups.boardId()).toBe('board-1');
    backend.expectOne('/api/teacher/boards/board-1/backups').flush([]);
    backups.restored.emit();
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);

    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');
    await act('Алгебра', 'Удалить…');
    const confirmation = confirm.mock.calls[0]?.[0];
    expect(confirmation?.message).toContain('вместе с рисунком');
    confirmation?.accept?.();
    await fixture.whenStable();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/boards/board-1' }).flush(null);
    backend.expectOne('/api/teacher/boards').flush([]);
    await fixture.whenStable();

    expect(host.textContent).toContain('Досок пока нет');
  });

  it('explains what happens to an external board when it is deleted', async () => {
    await render();
    backend.expectOne('/api/teacher/boards').flush([aLinkBoard()]);
    await fixture.whenStable();
    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');

    buttonByText(host, 'Действия: Холст').click();
    await fixture.whenStable();
    expect(() => menuItemByText('Резервные копии')).toThrow();
    menuItemByText('Удалить…').click();

    expect(confirm.mock.calls[0]?.[0].message).toContain('сама доска в другом сервисе останется');
    expect(bodyText()).not.toContain('Не удалось загрузить');
  });

  /** The «⋮» menu of a board, then one of its items. */
  async function act(title: string, item: string): Promise<void> {
    buttonByText(host, `Действия: ${title}`).click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }
});
