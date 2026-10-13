import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aMyBoard } from '@testing/boards-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MyBoardsPage } from './my-boards-page';

describe('MyBoardsPage', () => {
  let fixture: ComponentFixture<MyBoardsPage>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MyBoardsPage], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyBoardsPage);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists the boards of the portal in their card, a row opens its board', async () => {
    backend
      .expectOne('/api/me/boards')
      .flush([aMyBoard(), aMyBoard({ id: 'b2', title: 'Геометрия', groupNames: ['ОГЭ'] })]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('h1')?.textContent).toContain('Мои доски');
    expect(host.textContent).toContain('изменена 02.10.2026');
    expect(readableText(host)).toContain('группа «ОГЭ» · изменена');
    const rows = host.querySelectorAll('ul.tb-list[aria-label="Доски на портале"] > li');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.classList).toContain('tb-list__item--link');
    expect(rows[0]?.querySelector('a.tb-list__link')?.getAttribute('href')).toBe(
      '/cabinet/boards/board-1',
    );
    // no external boards: no card for them
    expect(host.textContent).not.toContain('Внешние доски');
  });

  it('puts external boards in their own card', async () => {
    backend.expectOne('/api/me/boards').flush([
      aMyBoard({ id: 'b3', kind: 'LINK', title: 'Холст', url: 'https://app.holst.so/board/1' }),
      aMyBoard({
        id: 'b4',
        kind: 'LINK',
        title: 'Миро',
        url: 'https://miro.com/1',
        groupNames: ['ОГЭ', 'ЕГЭ'],
      }),
    ]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.textContent).not.toContain('Доски на портале');
    const rows = host.querySelectorAll('ul.tb-list[aria-label="Внешние доски"] > li');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('.tb-list__supporting')).toBeNull();
    expect(rows[1]?.textContent).toContain('группы «ОГЭ», «ЕГЭ»');
    expect(rows[1]?.textContent).not.toContain('·');
    const link = rows[0]?.querySelector('a.tb-list__link');
    expect(link?.getAttribute('href')).toBe('https://app.holst.so/board/1');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('says when there are no boards and retries a failed load', async () => {
    backend.expectOne('/api/me/boards').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/me/boards').flush([]);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Досок пока нет');
  });
});
