import { ComponentFixture, TestBed } from '@angular/core/testing';
import { assignmentSummary } from '@testing/homework-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { AssignmentSummary } from '../data-access/homework.models';
import { AssignmentList } from './assignment-list';

describe('AssignmentList', () => {
  let fixture: ComponentFixture<AssignmentList>;
  let host: HTMLElement;

  async function render(assignments: AssignmentSummary[]): Promise<void> {
    TestBed.configureTestingModule({ imports: [AssignmentList], providers: testProviders() });
    fixture = TestBed.createComponent(AssignmentList);
    fixture.componentRef.setInput('heading', 'Активные');
    fixture.componentRef.setInput('assignments', assignments);
    fixture.componentRef.setInput('emptyTitle', 'Активных заданий нет');
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  function titles(): string[] {
    return [...host.querySelectorAll('.tb-list__title')].map((link) => link.textContent.trim());
  }

  async function find(text: string): Promise<void> {
    const input = host.querySelector<HTMLInputElement>('input[type="search"]');
    if (input === null) {
      throw new Error('no search');
    }
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  /** «Задание 1» … «Задание 23»: three pages of ten. */
  function many(): AssignmentSummary[] {
    return Array.from({ length: 23 }, (_, index) =>
      assignmentSummary({
        id: `a-${String(index + 1)}`,
        title: `Задание ${String(index + 1)}`,
        students: [index === 21 ? 'Вера' : 'Анна'],
      }),
    );
  }

  it('finds by the title or a student’s name, and says when nothing is found', async () => {
    await render([
      assignmentSummary({ id: 'a-1', title: 'Дроби', students: ['Анна'] }),
      assignmentSummary({ id: 'a-2', title: 'Степени', students: ['Борис', 'Вера'] }),
    ]);
    expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Поиск: Активные');

    await find('дРОб');
    expect(titles()).toEqual(['Дроби']);
    await find('вера');
    expect(titles()).toEqual(['Степени']);
    await find('логарифмы');
    expect(titles()).toEqual([]);
    expect(readableText(host)).toContain('Ничего не найдено');
  });

  it('shows ten rows a page and starts a new search from the first page', async () => {
    await render(many());
    expect(titles()).toHaveLength(10);
    expect(titles()[0]).toBe('Задание 1');

    host.querySelector<HTMLButtonElement>('button[aria-label="3"], .p-paginator-last')?.click();
    await fixture.whenStable();
    expect(titles()).toEqual(['Задание 21', 'Задание 22', 'Задание 23']);

    await find('Вера');
    expect(titles()).toEqual(['Задание 22']);
    expect(host.querySelector('p-paginator')).toBeNull();
  });

  it('keeps a page when its last row is deleted', async () => {
    await render(many());
    host.querySelector<HTMLButtonElement>('.p-paginator-last')?.click();
    await fixture.whenStable();

    fixture.componentRef.setInput('assignments', many().slice(0, 20));
    await fixture.whenStable();

    expect(titles()[0]).toBe('Задание 11');
  });

  it('says when the list is empty, without a search', async () => {
    await render([]);

    expect(host.querySelector('input')).toBeNull();
    expect(readableText(host)).toContain('Активных заданий нет');
  });

  it('asks the page for the menu of a row', async () => {
    await render([assignmentSummary()]);
    const asked: string[] = [];
    fixture.componentInstance.actions.subscribe(({ assignment }) => asked.push(assignment.id));

    host.querySelector<HTMLButtonElement>('button[aria-label="Действия: Дроби"]')?.click();

    expect(asked).toEqual(['a-1']);
  });

  it('leaves only the work to review with the «На проверку» toggle', async () => {
    await render([
      assignmentSummary({ id: 'a-1', title: 'Дроби', submitted: 2 }),
      assignmentSummary({ id: 'a-2', title: 'Степени', submitted: 0 }),
    ]);
    expect(host.querySelector('.tb-toolbar p-button button')).toBeNull();
    fixture.componentRef.setInput('reviewFilter', true);
    await fixture.whenStable();
    const toggle = host.querySelector<HTMLButtonElement>('.tb-toolbar p-button button');
    expect(readableText(toggle ?? host)).toContain('На проверку 2');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');

    toggle?.click();
    await fixture.whenStable();
    expect(titles()).toEqual(['Дроби']);
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');

    fixture.componentRef.setInput('assignments', [
      assignmentSummary({ id: 'a-1', title: 'Дроби', submitted: 0 }),
    ]);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Работ на проверку нет');

    host.querySelector<HTMLButtonElement>('.tb-toolbar p-button button')?.click();
    await fixture.whenStable();
    expect(titles()).toEqual(['Дроби']);
  });
});
