import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { aBoardContent } from '@testing/boards-fixtures';
import { buttonByText, hostElement } from '@testing/dom';
import { FakeIsland, anElement, fakeExcalidraw, fakeScene } from '@testing/excalidraw-fake';
import { testProviders } from '@testing/setup';
import { BoardBackupsDialog } from '../teacher/board-backups-dialog';
import { BoardInsert } from '../to-board/board-insert';
import { BoardPage } from './board-page';
import { ExcalidrawLoader } from './excalidraw-loader';

describe('BoardPage', () => {
  let fixture: ComponentFixture<BoardPage>;
  let backend: HttpTestingController;
  let island: FakeIsland;
  let host: HTMLElement;

  function render(area: 'teacher' | 'cabinet' = 'teacher'): void {
    island = fakeExcalidraw();
    TestBed.configureTestingModule({
      imports: [BoardPage],
      providers: testProviders({
        provide: ExcalidrawLoader,
        useValue: { load: () => Promise.resolve(island.modules) },
      }),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BoardPage);
    fixture.componentRef.setInput('id', 'board-1');
    fixture.componentRef.setInput('area', area);
    fixture.detectChanges();
    host = hostElement(fixture);
  }

  /** The board arrives, Excalidraw mounts and hands out its API. */
  async function open(content = aBoardContent()): Promise<ReturnType<typeof fakeScene>> {
    backend.expectOne('/api/boards/board-1').flush(content);
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    const scene = fakeScene();
    Reflect.apply(island.last().excalidrawAPI ?? fail, undefined, [scene.access]);
    return scene;
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('opens the teacher’s board full screen with its way back and its menu', async () => {
    render();
    await open();

    expect(host.querySelector('h1')?.textContent).toContain('Алгебра');
    expect(host.querySelector('a[href="/teacher/boards"]')?.textContent).toContain('Доски');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Сохранено');
    expect(island.last()).toMatchObject({ theme: 'light', langCode: 'ru-RU' });
    expect(island.menu.map((item) => item.label)).toEqual([
      'Вернуться к доскам',
      'Резервные копии',
    ]);
    expect(host.querySelector('.tb-board-page__bar')?.textContent).not.toContain('Резервные копии');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    island.menu[0]?.onSelect();
    expect(navigate).toHaveBeenCalledWith('/teacher/boards');

    island.menu[1]?.onSelect();
    await fixture.whenStable();
    const backups = fixture.debugElement
      .query(By.directive(BoardBackupsDialog))
      .injector.get(BoardBackupsDialog);
    expect(backups.visible()).toBe(true);
    backend.expectOne('/api/teacher/boards/board-1/backups').flush([]);
    backups.restored.emit();
    backend.expectOne('/api/boards/board-1/scene?since=3').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('gives the student their way back and no copies', async () => {
    render('cabinet');
    await open();

    expect(host.querySelector('a[href="/cabinet/boards"]')?.textContent).toContain('Мои доски');
    expect(island.menu.map((item) => item.label)).toEqual(['Вернуться к доскам']);
    expect(host.textContent).not.toContain('Резервные копии');
  });

  it('keeps the user’s library on the server', async () => {
    render('cabinet');
    await open();
    const library = island.last().library ?? fail();
    const item = { id: 'circle', status: 'unpublished', created: 1, elements: [] };

    const loaded = library.load();
    backend.expectOne('/api/boards/library').flush([item]);
    await expect(loaded).resolves.toEqual([item]);

    const broken = library.load();
    backend.expectOne('/api/boards/library').flush([{ id: 'no-elements' }]);
    await expect(broken).resolves.toEqual([]);

    const saved = library.save([]);
    const request = backend.expectOne({ method: 'PUT', url: '/api/boards/library' });
    expect(request.request.body).toEqual([]);
    request.flush([]);
    await expect(saved).resolves.toBeUndefined();
  });

  it('saves before leaving and asks when the server is away', async () => {
    render();
    const scene = await open();
    const page = fixture.componentInstance;
    await expect(page.canLeave()).resolves.toBe(true);

    const elements = [anElement('new', 1)];
    scene.state.elements = elements;
    Reflect.apply(island.last().onChange ?? fail, undefined, [elements, scene.state.appState, {}]);
    const leaving = page.canLeave();
    await Promise.resolve();
    backend.expectOne({ method: 'PUT', url: '/api/boards/board-1/scene' }).flush(null, {
      status: 503,
      statusText: 'Unavailable',
    });
    const confirm = vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm');
    await vi.waitFor(() => {
      expect(confirm).toHaveBeenCalled();
    });
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Нет связи');
    confirm.mock.calls[0]?.[0].accept?.();
    await expect(leaving).resolves.toBe(true);
  });

  it('saves when the tab is hidden and asks for changes when it is back', async () => {
    render();
    await open();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    backend.expectOne('/api/boards/board-1/scene?since=3').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });

  it('puts the material from «На доску» on the board', async () => {
    render();
    TestBed.inject(BoardInsert).put('board-1', { title: 'Дроби', markdown: '', mode: 'text' });
    const scene = await open();

    await vi.waitFor(() => {
      expect(scene.state.elements).toEqual([expect.objectContaining({ text: 'Дроби' })]);
    });
  });

  it('offers the link of an external board', async () => {
    render();
    backend
      .expectOne('/api/boards/board-1')
      .flush(aBoardContent({ kind: 'LINK', url: 'https://app.holst.so/board/1', elements: [] }));
    await fixture.whenStable();

    expect(host.querySelector('a[href="https://app.holst.so/board/1"]')).not.toBeNull();
    expect(host.querySelector('tb-board-canvas')).toBeNull();
    await expect(fixture.componentInstance.canLeave()).resolves.toBe(true);
  });

  it('retries a board that did not load', async () => {
    render();
    backend.expectOne('/api/boards/board-1').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(host.textContent).toContain('Не удалось загрузить доску');

    buttonByText(host, 'Повторить').click();
    await open();
    expect(host.querySelector('tb-board-canvas')).not.toBeNull();
  });
});

function fail(): never {
  throw new Error('Excalidraw got no callback');
}
