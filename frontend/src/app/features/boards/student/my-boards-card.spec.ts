import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aMyBoard } from '@testing/boards-fixtures';
import { buttonByText, hostElement } from '@testing/dom';
import { MyBoardsCard } from './my-boards-card';
import { testProviders } from '@testing/setup';

describe('MyBoardsCard', () => {
  let fixture: ComponentFixture<MyBoardsCard>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MyBoardsCard],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyBoardsCard);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('opens the boards of the student and of their groups', async () => {
    backend.expectOne('/api/me/boards').flush([
      aMyBoard(),
      aMyBoard({
        id: 'board-2',
        kind: 'LINK',
        url: 'https://app.holst.so/board/2',
        groupNames: ['ОГЭ'],
        title: 'Общая',
      }),
      aMyBoard({ id: 'board-3', groupNames: ['ОГЭ', 'ЕГЭ'], title: 'Третья' }),
      aMyBoard({ id: 'board-4', title: 'Четвёртая' }),
    ]);
    await fixture.whenStable();

    const text = hostElement(fixture).textContent;
    expect(text).toContain('Мои доски');
    expect(text).toContain('группа «ОГЭ»');
    expect(text).toContain('группы «ОГЭ», «ЕГЭ»');
    expect(text).not.toContain('Четвёртая');
    const links = hostElement(fixture).querySelectorAll('a');
    expect(links).toHaveLength(4);
    expect(links[0]?.getAttribute('href')).toBe('/cabinet/boards/board-1');
    expect(links[1]?.getAttribute('href')).toBe('https://app.holst.so/board/2');
    expect(links[1]?.getAttribute('target')).toBe('_blank');
    expect(links[3]?.textContent).toContain('Все доски (4)');
  });

  it('is hidden while there are no boards', async () => {
    backend.expectOne('/api/me/boards').flush([]);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).not.toContain('Мои доски');
  });

  it('shows a failed load with «Повторить» instead of hiding', async () => {
    backend.expectOne('/api/me/boards').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toContain('Не удалось загрузить доски');

    buttonByText(hostElement(fixture), 'Повторить').click();
    backend.expectOne('/api/me/boards').flush([aMyBoard()]);
    await fixture.whenStable();

    expect(hostElement(fixture).querySelectorAll('a')).toHaveLength(2);
  });
});
