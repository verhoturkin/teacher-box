import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aCourse } from '@testing/textbooks-fixtures';
import { buttonByText, hostElement, menuItemByText, requireElement, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Confirm } from '@shared/ui/confirm';
import { CourseList } from './course-list';

describe('CourseList', () => {
  let fixture: ComponentFixture<CourseList>;
  let backend: HttpTestingController;
  let confirmed: boolean;
  let changes: number;
  const a2 = aCourse({ id: 'a2', name: 'A2' });
  const b1 = aCourse({ id: 'b1', name: 'B1', position: 1 });

  beforeEach(async () => {
    confirmed = true;
    TestBed.configureTestingModule({ imports: [CourseList], providers: testProviders() });
    vi.spyOn(TestBed.inject(Confirm), 'danger').mockImplementation(() =>
      Promise.resolve(confirmed),
    );
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CourseList);
    changes = 0;
    fixture.componentInstance.changed.subscribe(() => (changes += 1));
    fixture.componentInstance.courses.set([a2, b1]);
    fixture.componentRef.setInput('queryParams', (id: string) => ({ course: id, tab: 'plans' }));
    fixture.componentRef.setInput('counts', new Map([['a2', 4]]));
    fixture.componentRef.setInput('current', 'b1');
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  const host = (): HTMLElement => hostElement(fixture);
  const courses = (): string[] => fixture.componentInstance.courses().map((course) => course.name);
  const button = (label: string): HTMLButtonElement =>
    requireElement(host(), `button[aria-label="${label}"]`, HTMLButtonElement);

  async function action(course: string, item: string): Promise<void> {
    button(`Действия с курсом «${course}»`).click();
    await fixture.whenStable();
    menuItemByText(item).click();
    await fixture.whenStable();
  }

  it('links every course with its count and marks the current one', () => {
    const links = [...host().querySelectorAll<HTMLAnchorElement>('a.tb-list__link')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/?course=a2&tab=plans',
      '/?course=b1&tab=plans',
    ]);
    expect(links[0]?.textContent).toContain('A2, 4 материала');
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
    expect(host().querySelector('.tb-list__item--current')?.textContent).toContain('B1');
    expect(
      [...host().querySelectorAll('.tb-course-list__count')].map((count) => count.textContent),
    ).toEqual(['4', '0']);
  });

  it('adds a course from «+ Новый курс»; a blank name or Escape closes the field', async () => {
    buttonByText(host(), 'Новый курс').click();
    await fixture.whenStable();
    const field = (): HTMLInputElement =>
      requireElement(host(), 'input[aria-label="Новый курс"]', HTMLInputElement);
    expect(document.activeElement).toBe(field());
    field().dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host().querySelector('input')).toBeNull();

    buttonByText(host(), 'Новый курс').click();
    await fixture.whenStable();
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(host().querySelector('input')).toBeNull();

    buttonByText(host(), 'Новый курс').click();
    await fixture.whenStable();
    button('Добавить').click();
    await fixture.whenStable();
    backend.expectNone('/api/teacher/textbooks/courses');
    expect(host().querySelector('input')).toBeNull();

    buttonByText(host(), 'Новый курс').click();
    await fixture.whenStable();
    typeInto(field(), ' ОГЭ ');
    field().dispatchEvent(new Event('blur'));
    field().form?.dispatchEvent(new Event('submit', { cancelable: true }));
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks/courses' });
    expect(create.request.body).toEqual({ name: 'ОГЭ' });
    create.flush(aCourse({ id: 'oge', name: 'ОГЭ', position: 2 }));
    await fixture.whenStable();
    expect(courses()).toEqual(['A2', 'B1', 'ОГЭ']);
    expect(host().querySelector('input')).toBeNull();
    expect(changes).toBe(0);
  });

  it('renames a course in place; Escape and an unchanged name send nothing', async () => {
    const field = (): HTMLInputElement =>
      requireElement(host(), 'input[aria-label="Новое название курса «A2»"]', HTMLInputElement);
    await action('A2', 'Переименовать');
    expect(document.activeElement).toBe(field());
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(host().querySelector('input')).toBeNull();

    await action('A2', 'Переименовать');
    button('Сохранить').click();
    await fixture.whenStable();
    expect(host().querySelector('input')).toBeNull();

    await action('A2', 'Переименовать');
    button('Отмена').click();
    await fixture.whenStable();
    expect(host().querySelector('input')).toBeNull();

    await action('A2', 'Переименовать');
    typeInto(field(), 'A2+');
    field().form?.dispatchEvent(new Event('submit', { cancelable: true }));
    const rename = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/a2' });
    expect(rename.request.body).toEqual({ name: 'A2+', version: 0 });
    rename.flush(aCourse({ id: 'a2', name: 'A2+', version: 1 }));
    await fixture.whenStable();
    expect(courses()).toEqual(['A2+', 'B1']);
    expect(changes).toBe(1);
  });

  it('deletes a course after the confirmation only', async () => {
    confirmed = false;
    await action('B1', 'Удалить…');
    backend.expectNone('/api/teacher/textbooks/courses/b1');

    confirmed = true;
    await action('B1', 'Удалить…');
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/courses/b1' }).flush(null);
    await fixture.whenStable();
    expect(courses()).toEqual(['A2']);
    expect(changes).toBe(1);
  });

  it('moves a course by the arrow keys on its handle and from «⋮»; a refused order rolls back', async () => {
    // the top course goes no higher, other keys do nothing
    button('Переместить: A2').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    button('Переместить: B1').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    backend.expectNone('/api/teacher/textbooks/courses/order');

    button('Переместить: B1').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    const moved = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/order' });
    expect(moved.request.body).toEqual({ ids: ['b1', 'a2'] });
    moved.flush([b1, a2]);
    expect(courses()).toEqual(['B1', 'A2']);

    button('Переместить: A2').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/order' })
      .flush('', { status: 409, statusText: 'Conflict' });
    expect(courses()).toEqual(['B1', 'A2']);

    await action('B1', 'Ниже');
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/order' })
      .flush([a2, b1]);
    await action('B1', 'Выше');
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/order' })
      .flush([b1, a2]);
    expect(courses()).toEqual(['B1', 'A2']);
  });
});
