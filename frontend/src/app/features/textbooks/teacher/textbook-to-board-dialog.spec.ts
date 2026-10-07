import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ToBoardDialog } from '@features/boards/parts';
import { aBoard } from '@testing/boards-fixtures';
import { bodyText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BoardTextbook, TextbookToBoardDialog } from './textbook-to-board-dialog';

describe('TextbookToBoardDialog', () => {
  let fixture: ComponentFixture<TextbookToBoardDialog>;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TextbookToBoardDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TextbookToBoardDialog);
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(
    textbook: BoardTextbook,
    pages: string | null = null,
  ): Promise<ToBoardDialog> {
    fixture.componentRef.setInput('textbook', textbook);
    fixture.componentRef.setInput('initialPages', pages);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/boards').flush([aBoard()]);
    await fixture.whenStable();
    return fixture.debugElement.query(By.directive(ToBoardDialog)).injector.get(ToBoardDialog);
  }

  it('puts the chosen pages of a PDF in a frame', async () => {
    const board = await open(
      { id: 'tb-1', title: 'Spotlight 5', format: 'PDF', pageCount: 120 },
      '12-14',
    );
    expect(board.pages()).toEqual({
      title: 'Spotlight 5, с. 12-14',
      mode: 'pages',
      pictures: [12, 13, 14].map((page) => `/api/teacher/textbooks/tb-1/pages/${String(page)}`),
    });
    expect(bodyText()).toContain('В учебнике 120 с.');

    typeInto(requireElement(document.body, '#board-pages', HTMLInputElement), '121');
    await fixture.whenStable();
    expect(board.pages()?.pictures).toEqual([]);
    expect(bodyText()).toContain('Страницы от 1 до 120');
  });

  it('starts with the first page and takes an image whole', async () => {
    const pdf = await open({ id: 'tb-1', title: 'Spotlight 5', format: 'PDF', pageCount: 5 });
    expect(pdf.pages()?.title).toBe('Spotlight 5, с. 1');
    fixture.componentInstance.visible.set(false);
    await fixture.whenStable();

    const image = await open({ id: 'tb-3', title: 'Скан', format: 'IMAGE', pageCount: 1 });
    expect(document.body.querySelector('#board-pages')).toBeNull();
    expect(image.pages()).toEqual({
      title: 'Скан',
      mode: 'pages',
      pictures: ['/api/teacher/textbooks/tb-3/pages/1'],
    });
  });

  it('has no pictures of a Word file', () => {
    fixture.componentRef.setInput('textbook', {
      id: 'tb-2',
      title: 'Тетрадь',
      format: 'DOCUMENT',
      pageCount: 10,
    });
    expect(fixture.componentInstance.material()).toBeNull();
  });
});
