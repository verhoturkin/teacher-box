import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { assignmentDetails, boundTextbook } from '@testing/homework-fixtures';
import { aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AssignmentDetails } from '../data-access/homework.models';
import { BindTextbookDialog, PAGES_PATTERN } from './bind-textbook-dialog';

describe('BindTextbookDialog', () => {
  let fixture: ComponentFixture<BindTextbookDialog>;
  let backend: HttpTestingController;
  let saved: AssignmentDetails[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BindTextbookDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BindTextbookDialog);
    fixture.componentRef.setInput('assignmentId', 'a-1');
    saved = [];
    fixture.componentInstance.saved.subscribe((assignment) => saved.push(assignment));
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

  it('binds a textbook not bound yet, with its pages', async () => {
    fixture.componentRef.setInput('taken', [boundTextbook({ textbookId: 'tb-2' })]);
    const dialog = await open();
    backend
      .expectOne('/api/teacher/textbooks')
      .flush([aTextbook(), aWorkbook(), aTextbook({ id: 'tb-3', format: 'IMAGE', title: 'Скан' })]);
    await fixture.whenStable();
    expect(bodyText()).toContain('Учебник к заданию');

    dialog.save();
    backend.expectNone('/api/teacher/homework/assignments/a-1/textbooks');
    dialog.textbook.setValue('tb-1');
    dialog.pages.setValue('12-14, x');
    await fixture.whenStable();
    expect(bodyText()).toContain('Ученик получит только эти страницы');
    expect(bodyText()).toContain('120 с.');
    dialog.save();
    backend.expectNone('/api/teacher/homework/assignments/a-1/textbooks');

    dialog.pages.setValue(' 12-14, 20 ');
    await fixture.whenStable();
    buttonByText(document.body, 'Привязать').click();
    const bind = backend.expectOne({
      method: 'POST',
      url: '/api/teacher/homework/assignments/a-1/textbooks',
    });
    expect(bind.request.body).toEqual({ textbookId: 'tb-1', pages: '12-14, 20' });
    bind.flush(assignmentDetails());
    expect(saved).toHaveLength(1);
    expect(dialog.visible()).toBe(false);
  });

  it('binds an image whole and reports a refusal', async () => {
    const dialog = await open();
    backend
      .expectOne('/api/teacher/textbooks')
      .flush([aTextbook({ id: 'tb-3', format: 'IMAGE', title: 'Скан' })]);
    dialog.textbook.setValue('tb-3');
    dialog.pages.setValue('5');
    await fixture.whenStable();
    expect(document.body.querySelector('#bind-pages')).toBeNull();
    dialog.save();
    const bind = backend.expectOne('/api/teacher/homework/assignments/a-1/textbooks');
    expect(bind.request.body).toEqual({ textbookId: 'tb-3', pages: null });
    bind.flush(
      { status: 422, code: 'textbooks.pages-beyond' },
      { status: 422, statusText: 'Unprocessable Content' },
    );
    await fixture.whenStable();
    expect(bodyText()).toContain('В учебнике меньше страниц');
    expect(dialog.visible()).toBe(true);
  });

  it('changes the pages of a bound Word file', async () => {
    fixture.componentRef.setInput(
      'bound',
      boundTextbook({ textbookId: 'tb-2', title: 'Тетрадь', format: 'DOCUMENT', pageCount: null }),
    );
    const dialog = await open();
    expect(bodyText()).toContain('Страницы учебника');
    expect(bodyText()).toContain('Файл Word ученик получит целиком');
    expect(dialog.pages.value).toBe('12-14');
    dialog.pages.setValue('');
    dialog.save();
    const bind = backend.expectOne('/api/teacher/homework/assignments/a-1/textbooks');
    expect(bind.request.body).toEqual({ textbookId: 'tb-2', pages: null });
    bind.flush(assignmentDetails());
  });

  it('says when every textbook is bound already', async () => {
    fixture.componentRef.setInput('taken', [boundTextbook()]);
    await open();
    backend.expectOne('/api/teacher/textbooks').flush([aTextbook()]);
    await fixture.whenStable();
    expect(bodyText()).toContain('Свободных учебников нет');
  });

  it('accepts pages as numbers and ranges', () => {
    expect(PAGES_PATTERN.test('12-14, 20')).toBe(true);
    expect(PAGES_PATTERN.test('3 5 7–9')).toBe(true);
    expect(PAGES_PATTERN.test('12-')).toBe(false);
  });
});
