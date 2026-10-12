import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aMyBoard } from '@testing/boards-fixtures';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MyBoardButton } from './my-board-button';

describe('MyBoardButton', () => {
  let fixture: ComponentFixture<MyBoardButton>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MyBoardButton], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyBoardButton);
    fixture.componentRef.setInput('boardId', 'board-2');
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('leads to the board of the task when it is one of the student’s', async () => {
    backend.expectOne('/api/me/boards').flush([aMyBoard(), aMyBoard({ id: 'board-2' })]);
    await fixture.whenStable();

    const link = hostElement(fixture).querySelector('a');
    expect(link?.textContent).toContain('Перейти на доску');
    expect(link?.getAttribute('href')).toBe('/cabinet/boards/board-2');
  });

  it('opens an external board by its link', async () => {
    backend
      .expectOne('/api/me/boards')
      .flush([aMyBoard({ id: 'board-2', kind: 'LINK', url: 'https://app.holst.so/board/2' })]);
    await fixture.whenStable();

    const link = hostElement(fixture).querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://app.holst.so/board/2');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('shows nothing for a board the student does not have', async () => {
    backend.expectOne('/api/me/boards').flush([aMyBoard()]);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('a')).toBeNull();

    fixture.componentRef.setInput('boardId', 'board-3');
    await fixture.whenStable();
    backend.expectOne('/api/me/boards').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('a')).toBeNull();
  });
});
