import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aTextbook, aWorkbook } from '@testing/textbooks-fixtures';
import { bodyText, requireElement } from '@testing/dom';
import { formData } from '@testing/form-data';
import { testProviders } from '@testing/setup';
import { Textbook } from '../data-access/textbooks.models';
import { TextbookDialog } from './textbook-dialog';

describe('TextbookDialog', () => {
  let fixture: ComponentFixture<TextbookDialog>;
  let backend: HttpTestingController;
  let saved: Textbook[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [TextbookDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TextbookDialog);
    saved = [];
    fixture.componentInstance.saved.subscribe((textbook) => saved.push(textbook));
    fixture.componentRef.setInput('students', [{ id: 's-1', name: 'Мария' }]);
    fixture.componentRef.setInput('groups', [{ id: 'g-1', name: 'ОГЭ' }]);
    fixture.componentRef.setInput('courses', ['Английский']);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(textbook: Textbook | null = null): Promise<TextbookDialog> {
    fixture.componentRef.setInput('textbook', textbook);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  async function pick(file: File): Promise<void> {
    const input = requireElement(document.body, 'input[type="file"]', HTMLInputElement);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('adds a textbook only with a file; the title comes from the file name', async () => {
    const dialog = await open();
    expect(bodyText()).toContain('Новый учебник');
    expect(document.body.querySelector('option[value="Английский"]')).not.toBeNull();

    dialog.save();
    await fixture.whenStable();
    expect(bodyText()).toContain('Выберите файл.');
    backend.expectNone('/api/teacher/textbooks');

    await pick(new File(['%PDF-'], 'Spotlight 5.pdf'));
    expect(dialog.form.controls.title.value).toBe('Spotlight 5');
    expect(bodyText()).toContain('Spotlight 5.pdf');
    expect(document.body.querySelector('#textbook-pages')).toBeNull();
    dialog.form.patchValue({ course: ' Английский ', studentIds: ['s-1'] });

    dialog.save();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks' });
    const form = formData(create.request.body);
    expect(form.get('title')).toBe('Spotlight 5');
    expect(form.get('course')).toBe('Английский');
    expect(form.has('pageCount')).toBe(false);
    create.flush(aTextbook());
    expect(saved).toEqual([aTextbook()]);
    expect(dialog.visible()).toBe(false);
  });

  it('asks for the pages of a Word file and refuses a file over 100 MB', async () => {
    const dialog = await open();
    dialog.form.patchValue({ title: 'Своё название' });
    const huge = new File(['x'], 'Тетрадь.docx');
    Object.defineProperty(huge, 'size', { value: 101 * 1024 * 1024 });
    await pick(huge);
    expect(dialog.form.controls.title.value).toBe('Своё название');
    expect(bodyText()).toContain('Файл больше 100 МБ');
    expect(document.body.querySelector('#textbook-pages')).not.toBeNull();
    dialog.save();
    backend.expectNone('/api/teacher/textbooks');

    await pick(new File(['PK'], 'Тетрадь.docx'));
    dialog.form.patchValue({ pageCount: 48 });
    dialog.save();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks' });
    expect(formData(create.request.body).get('pageCount')).toBe('48');
    create.flush(null, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();
    expect(bodyText()).toContain('Не удалось сохранить');
    expect(dialog.visible()).toBe(true);
  });

  it('changes a textbook, keeping members that left', async () => {
    const dialog = await open(
      aWorkbook({
        members: [{ type: 'STUDENT', id: 'gone', name: null }],
        course: 'Английский',
        version: 2,
      }),
    );
    expect(bodyText()).toContain('Изменить учебник');
    expect(document.body.querySelector('input[type="file"]')).toBeNull();
    expect(dialog.studentOptions()).toEqual([
      { id: 's-1', name: 'Мария' },
      { id: 'gone', name: 'Нет в списке' },
    ]);
    expect(dialog.form.controls.pageCount.value).toBe(48);
    dialog.form.patchValue({ course: '  ', pageCount: 50 });

    dialog.save();
    const change = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/tb-2' });
    expect(change.request.body).toEqual({
      kind: 'WORKBOOK',
      title: 'Рабочая тетрадь',
      course: null,
      pageCount: 50,
      studentIds: ['gone'],
      groupIds: [],
      version: 2,
    });
    change.flush(aWorkbook());
    expect(saved).toHaveLength(1);
  });

  it('does not send the pages of a PDF', async () => {
    const dialog = await open(aTextbook());
    expect(dialog.form.controls.pageCount.value).toBeNull();
    dialog.save();
    const change = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/tb-1' });
    expect(change.request.body).toMatchObject({ pageCount: null, groupIds: ['g-1'] });
    change.flush(aTextbook());
  });
});
