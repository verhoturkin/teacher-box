import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { screenWidth, testProviders } from '@testing/setup';
import { assignmentDetails, assignmentSummary, reviewQueueItem } from '@testing/homework-fixtures';
import { AssignMoreDialog } from './assign-more-dialog';
import { AssignmentsPage } from './assignments-page';
import { JournalView } from './journal-view';
import { Journal, JournalCell } from '../data-access/homework.models';

const JOURNAL = '/api/teacher/homework/journal';

function cell(overrides: Partial<JournalCell> = {}): JournalCell {
  return {
    status: 'WAITING',
    taskId: 't-1',
    grade: null,
    quizScore: null,
    quizMax: null,
    overdueDays: null,
    ...overrides,
  };
}

/** Anna: every status; Boris: nothing given. Two columns for the rest of the statuses are in `MANY`. */
const WEEK: Journal = {
  assignments: [
    { id: 'a-1', title: 'Present Perfect', dueAt: '2026-09-03T10:00:00Z' },
    { id: 'a-2', title: 'Reading', dueAt: '2026-09-04T10:00:00Z' },
  ],
  students: [
    {
      studentId: 's-1',
      studentName: 'Анна Смирнова',
      studentAvatar: null,
      cells: [
        cell({ status: 'TO_REVIEW', taskId: 't-review', quizScore: 8, quizMax: 10 }),
        cell({ status: 'ACCEPTED', taskId: 't-ok', grade: '5' }),
      ],
      handedIn: 2,
      given: 2,
    },
    {
      studentId: 's-2',
      studentName: 'Борис Орлов',
      studentAvatar: null,
      cells: [cell({ status: 'WAITING' }), cell({ status: 'NOT_ASSIGNED', taskId: null })],
      handedIn: 0,
      given: 1,
    },
  ],
};

const MANY: Journal = {
  assignments: [
    { id: 'a-1', title: 'Один', dueAt: '2026-09-03T10:00:00Z' },
    { id: 'a-2', title: 'Два', dueAt: '2026-09-03T11:00:00Z' },
    { id: 'a-3', title: 'Три', dueAt: '2026-09-03T12:00:00Z' },
    { id: 'a-4', title: 'Четыре', dueAt: '2026-09-03T13:00:00Z' },
  ],
  students: [
    {
      studentId: 's-1',
      studentName: 'Илья Петров',
      studentAvatar: null,
      cells: [
        cell({ status: 'ACCEPTED', taskId: 't-1' }),
        cell({ status: 'TO_REVIEW', taskId: 't-2' }),
        cell({ status: 'RETURNED', taskId: 't-3' }),
        cell({ status: 'OVERDUE', taskId: 't-4', overdueDays: 2 }),
      ],
      handedIn: 2,
      given: 4,
    },
  ],
};

describe('JournalView', () => {
  // Wednesday 2 September 2026: the week is 31 August – 6 September
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function render(journal: Journal = WEEK) {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(1200)) });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(JournalView);
    await fixture.whenStable();
    backend
      .expectOne(
        (request) => request.url === JOURNAL && request.params.get('from') === '2026-08-31',
      )
      .flush(journal);
    await fixture.whenStable();
    return { backend, fixture, host: hostElement(fixture) };
  }

  function cells(host: HTMLElement): HTMLButtonElement[] {
    return [...host.querySelectorAll<HTMLButtonElement>('button.tb-journal__cell')];
  }

  it('asks for the week of today and shows the range', async () => {
    const { host } = await render();

    expect(readableText(requireElement(host, '.tb-journal__range', HTMLElement))).toContain('31');
  });

  it('shows the students by the assignments with a status in every cell', async () => {
    const { host } = await render();

    expect(readableText(host)).toContain('Анна Смирнова');
    expect(host.querySelector('a[href="/teacher/homework/a-1"]')?.textContent).toContain(
      'Present Perfect',
    );
    expect(cells(host).map((button) => readableText(button))).toEqual([
      '8/10 · проверить',
      'Принято · 5',
      'ждём',
      'не выдано',
    ]);
    expect(cells(host)[0]?.getAttribute('aria-label')).toBe(
      'Анна Смирнова, Present Perfect: 8/10 · проверить',
    );
    expect(readableText(requireElement(host, '.tb-journal__total', HTMLElement))).toContain(
      '2 из 2',
    );
  });

  it('words every status', async () => {
    const { host } = await render(MANY);

    expect(cells(host).map((button) => readableText(button))).toEqual([
      'Принято',
      'проверить',
      'на доработке',
      'просрочено 2 дн.',
    ]);
  });

  it('moves between the weeks', async () => {
    const { backend, fixture, host } = await render();

    buttonByText(host, 'Следующая неделя').click();
    await fixture.whenStable();
    backend
      .expectOne((request) => request.params.get('from') === '2026-09-07')
      .flush({ assignments: [], students: [] });
    await fixture.whenStable();
    expect(host.querySelector('tb-empty-state')).not.toBeNull();

    buttonByText(host, 'Предыдущая неделя').click();
    await fixture.whenStable();
    backend.expectOne((request) => request.params.get('from') === '2026-08-31').flush(WEEK);
    await fixture.whenStable();
    expect(cells(host).length).toBe(4);
  });

  it('asks for the chosen group or student', async () => {
    const { backend, fixture } = await render();

    fixture.componentRef.setInput('who', 'g-1');
    await fixture.whenStable();

    backend.expectOne((request) => request.params.get('who') === 'g-1').flush(WEEK);
  });

  it('opens the review of a work waiting for it', async () => {
    const { fixture, host } = await render();
    const review = vi.fn();
    fixture.componentInstance.review.subscribe(review);

    cells(host)[0]?.click();

    expect(review).toHaveBeenCalledWith('t-review');
  });

  it('opens the assignment from any other cell', async () => {
    const { fixture, host } = await render();
    const open = vi.fn();
    fixture.componentInstance.openAssignment.subscribe(open);

    cells(host)[1]?.click();
    cells(host)[2]?.click();

    expect(open).toHaveBeenNthCalledWith(1, 'a-2');
    expect(open).toHaveBeenNthCalledWith(2, 'a-1');
  });

  it('gives the assignment to the student of an empty cell and reads the week again', async () => {
    const { backend, fixture, host } = await render();

    cells(host)[3]?.click();
    await fixture.whenStable();
    backend.expectOne('/api/teacher/groups').flush([]);
    backend.expectOne('/api/teacher/students').flush([]);
    await fixture.whenStable();
    const dialog = fixture.debugElement
      .query(By.directive(AssignMoreDialog))
      .injector.get(AssignMoreDialog);

    expect(dialog.visible()).toBe(true);
    expect(dialog.assignmentId()).toBe('a-2');
    expect(dialog.assigned()).toEqual(['s-1']);
    expect(dialog.members.value).toEqual([{ kind: 'STUDENT', id: 's-2' }]);

    dialog.saved.emit(assignmentDetails());
    await fixture.whenStable();
    backend.expectOne((request) => request.url === JOURNAL).flush(WEEK);
  });
});

describe('AssignmentsPage «По ученикам»', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('switches to the journal and back, and remembers it in the address', async () => {
    TestBed.configureTestingModule({ providers: testProviders(screenWidth(1200)) });
    vi.spyOn(TestBed.inject(MessageService), 'add');
    const backend = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssignmentsPage);
    const host = hostElement(fixture);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/homework/assignments').flush([assignmentSummary()]);
    backend.expectOne('/api/teacher/homework/review-queue').flush([reviewQueueItem()]);
    await fixture.whenStable();
    expect(host.querySelector('tb-journal-view')).toBeNull();

    buttonByText(host, 'По ученикам').click();
    await fixture.whenStable();
    backend.expectOne((request) => request.url === JOURNAL).flush(WEEK);
    await fixture.whenStable();

    expect(host.querySelector('tb-journal-view')).not.toBeNull();
    expect(host.querySelector('tb-search-field')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { view: 'journal' } }),
    );

    buttonByText(host, 'Списком').click();
    await fixture.whenStable();

    expect(host.querySelector('tb-journal-view')).toBeNull();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { view: null } }),
    );
  });
});
