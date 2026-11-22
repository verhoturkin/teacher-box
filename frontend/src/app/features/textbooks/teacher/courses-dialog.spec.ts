import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aCourse } from '@testing/textbooks-fixtures';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Confirm } from '@shared/ui/confirm';
import { Course } from '../data-access/courses.models';
import { CoursesDialog } from './courses-dialog';

describe('CoursesDialog', () => {
  let fixture: ComponentFixture<CoursesDialog>;
  let backend: HttpTestingController;
  let confirmed: boolean;
  let removed: Course[];
  const a2 = aCourse({ id: 'a2', name: 'A2' });
  const b1 = aCourse({ id: 'b1', name: 'B1', position: 1 });

  beforeEach(async () => {
    confirmed = true;
    TestBed.configureTestingModule({ imports: [CoursesDialog], providers: testProviders() });
    vi.spyOn(TestBed.inject(Confirm), 'danger').mockImplementation(() =>
      Promise.resolve(confirmed),
    );
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CoursesDialog);
    removed = [];
    fixture.componentInstance.removed.subscribe((course) => removed.push(course));
    fixture.componentInstance.courses.set([a2, b1]);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  const courses = (): string[] => fixture.componentInstance.courses().map((course) => course.name);
  const button = (label: string): HTMLButtonElement =>
    requireElement(document.body, `button[aria-label="${label}"]`, HTMLButtonElement);

  it('adds a course at the end and ignores a blank name', async () => {
    const field = requireElement(document.body, 'input[aria-label="Новый курс"]', HTMLInputElement);
    buttonByText(document.body, 'Добавить').click();
    backend.expectNone('/api/teacher/textbooks/courses');

    typeInto(field, ' ОГЭ ');
    field.form?.dispatchEvent(new Event('submit', { cancelable: true }));
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks/courses' });
    expect(create.request.body).toEqual({ name: 'ОГЭ' });
    create.flush(aCourse({ id: 'oge', name: 'ОГЭ', position: 2 }));
    await fixture.whenStable();
    expect(courses()).toEqual(['A2', 'B1', 'ОГЭ']);
    expect(field.value).toBe('');
  });

  it('renames a course in place; Escape and an unchanged name send nothing', async () => {
    button('Переименовать: A2').click();
    await fixture.whenStable();
    const field = (): HTMLInputElement =>
      requireElement(
        document.body,
        'input[aria-label="Новое название курса «A2»"]',
        HTMLInputElement,
      );
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(document.body.querySelector('input[aria-label^="Новое название"]')).toBeNull();
    expect(fixture.componentInstance.visible()).toBe(true);

    button('Переименовать: A2').click();
    await fixture.whenStable();
    button('Сохранить').click();
    await fixture.whenStable();
    expect(document.body.querySelector('input[aria-label^="Новое название"]')).toBeNull();

    button('Переименовать: A2').click();
    await fixture.whenStable();
    typeInto(field(), 'A2+');
    field().form?.dispatchEvent(new Event('submit', { cancelable: true }));
    const rename = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/a2' });
    expect(rename.request.body).toEqual({ name: 'A2+', version: 0 });
    rename.flush({ ...a2, name: 'A2+', version: 1 });
    await fixture.whenStable();
    expect(courses()).toEqual(['A2+', 'B1']);

    button('Переименовать: B1').click();
    await fixture.whenStable();
    button('Отмена').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('B1');
  });

  it('deletes a course only after the danger confirmation', async () => {
    confirmed = false;
    button('Удалить: A2').click();
    await fixture.whenStable();
    backend.expectNone('/api/teacher/textbooks/courses/a2');

    confirmed = true;
    button('Удалить: A2').click();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/courses/a2' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(courses()).toEqual(['B1']);
    expect(removed).toEqual([a2]);
  });

  it('moves a course with the arrow keys on its handle and rolls back a refused order', () => {
    const handle = button('Переместить: A2');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    backend.expectNone('/api/teacher/textbooks/courses/order');

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(courses()).toEqual(['B1', 'A2']);
    const order = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/textbooks/courses/order',
    });
    expect(order.request.body).toEqual({ ids: ['b1', 'a2'] });
    order.flush([
      { ...b1, position: 0 },
      { ...a2, position: 1 },
    ]);
    expect(fixture.componentInstance.courses()[0]?.position).toBe(0);

    button('Переместить: A2').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    backend
      .expectOne('/api/teacher/textbooks/courses/order')
      .flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(courses()).toEqual(['B1', 'A2']);
  });

  it('says when there are no courses', async () => {
    fixture.componentInstance.courses.set([]);
    await fixture.whenStable();
    expect(bodyText()).toContain('Курсов пока нет.');
  });
});
