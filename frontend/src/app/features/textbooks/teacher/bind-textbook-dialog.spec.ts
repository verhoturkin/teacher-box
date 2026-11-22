import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { PickedTextbook } from '../data-access/textbooks.models';
import { BindTextbookDialog, PAGES_PATTERN } from './bind-textbook-dialog';

function picked(overrides: Partial<PickedTextbook> = {}): PickedTextbook {
  return {
    textbookId: 'tb-1',
    kind: 'TEXTBOOK',
    title: 'Spotlight 5',
    courseName: 'Английский',
    format: 'PDF',
    pageCount: 120,
    pages: '12-14',
    ...overrides,
  };
}

describe('BindTextbookDialog', () => {
  let fixture: ComponentFixture<BindTextbookDialog>;
  let backend: HttpTestingController;
  let chosen: PickedTextbook[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BindTextbookDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BindTextbookDialog);
    chosen = [];
    fixture.componentInstance.picked.subscribe((textbook) => chosen.push(textbook));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(): Promise<BindTextbookDialog> {
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('hands the choice over with its normalized pages, checked against the textbook', async () => {
    const dialog = await open();
    backend
      .expectOne('/api/teacher/textbooks')
      .flush([
        aTextbook(),
        aTextbook({ id: 'tb-3', format: 'IMAGE', title: 'Скан', pageCount: 1 }),
      ]);
    await fixture.whenStable();
    expect(bodyText()).toContain('Учебник');

    dialog.save();
    expect(chosen).toEqual([]);
    dialog.textbook.setValue('tb-1');
    dialog.pages.setValue('119-121');
    dialog.save();
    await fixture.whenStable();
    expect(bodyText()).toContain('Таких страниц в учебнике нет');
    expect(chosen).toEqual([]);

    dialog.pages.setValue(' 12 – 14, 3 ');
    await fixture.whenStable();
    expect(bodyText()).toContain('Ученик получит только эти страницы');
    expect(bodyText()).toContain('120 с.');
    buttonByText(document.body, 'Привязать').click();
    await fixture.whenStable();
    expect(chosen).toEqual([
      expect.objectContaining({ textbookId: 'tb-1', title: aTextbook().title, pages: '3, 12-14' }),
    ]);
    expect(dialog.visible()).toBe(false);

    await open();
    backend.expectOne('/api/teacher/textbooks').flush([aTextbook({ id: 'tb-3', format: 'IMAGE' })]);
    dialog.textbook.setValue('tb-3');
    dialog.pages.setValue('5');
    await fixture.whenStable();
    expect(document.body.querySelector('#bind-pages')).toBeNull();
    dialog.save();
    await fixture.whenStable();
    expect(chosen[1]).toEqual(expect.objectContaining({ textbookId: 'tb-3', pages: null }));

    await open();
    backend.expectOne('/api/teacher/textbooks').flush([]);
    dialog.textbook.setValue('missing');
    dialog.save();
    expect(chosen).toHaveLength(2);
  });

  it('changes the pages of a chosen Word file without loading the textbooks', async () => {
    fixture.componentRef.setInput(
      'bound',
      picked({ textbookId: 'tb-2', title: 'Тетрадь', format: 'DOCUMENT', pageCount: null }),
    );
    const dialog = await open();
    expect(bodyText()).toContain('Страницы учебника');
    expect(bodyText()).toContain('Файл Word ученик получит целиком');
    expect(dialog.pages.value).toBe('12-14');
    dialog.pages.setValue('');
    dialog.save();
    await fixture.whenStable();
    expect(chosen).toEqual([expect.objectContaining({ textbookId: 'tb-2', pages: null })]);
  });

  it('names its headline and offers only the textbooks not taken', async () => {
    fixture.componentRef.setInput('headline', 'Учебник к плану');
    fixture.componentRef.setInput('taken', [picked()]);
    await open();
    backend.expectOne('/api/teacher/textbooks').flush([aTextbook()]);
    await fixture.whenStable();
    expect(bodyText()).toContain('Свободных учебников нет');
  });

  it('offers only the textbooks of the course when one is given', async () => {
    fixture.componentRef.setInput('courseId', 'c-2');
    await open();
    backend.expectOne('/api/teacher/textbooks').flush([aTextbook(), aWorkbook()]);
    await fixture.whenStable();
    expect(bodyText()).toContain('Свободных учебников курса нет');

    fixture.componentRef.setInput('courseId', 'c-1');
    fixture.componentRef.setInput('headline', 'Учебник к плану');
    await fixture.whenStable();
    expect(bodyText()).toContain('Учебник к плану');
    expect(bodyText()).not.toContain('Свободных учебников');
  });

  it('accepts pages as numbers and ranges', () => {
    expect(PAGES_PATTERN.test('12-14, 20')).toBe(true);
    expect(PAGES_PATTERN.test('3 5 7–9')).toBe(true);
    expect(PAGES_PATTERN.test('12-')).toBe(false);
  });
});
