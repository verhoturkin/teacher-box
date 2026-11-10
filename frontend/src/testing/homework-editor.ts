import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AssignmentEditorPage } from '@features/homework/teacher/assignment-editor-page';
import { UpcomingLesson } from '@features/homework/teacher/next-lesson';
import { aiStatus } from './ai-fixtures';
import { hostElement } from './dom';
import { assignmentDetails } from './homework-fixtures';
import { scheduledLesson } from './schedule-fixtures';
import { testProviders } from './setup';

/** The students of the editor's tests; the deactivated one is never offered. */
export const EDITOR_STUDENTS = [
  { id: 's-1', displayName: 'Анна', status: 'ACTIVE' },
  { id: 's-2', displayName: 'Борис', status: 'ACTIVE' },
  { id: 's-4', displayName: 'Гена', status: 'DEACTIVATED' },
].map((student) => ({
  ...student,
  avatar: null,
  email: null,
  phone: null,
  note: null,
  login: null,
  createdAt: '2026-09-01T10:00:00Z',
  version: 0,
  pendingInvite: null,
}));

export const DAY = 24 * 60 * 60 * 1000;

/** The tasks of the fixture with no quiz attempt: the questions stay editable. */
export const UNSTARTED = assignmentDetails().tasks.map((task) => ({
  ...task,
  quizScore: null,
  quizMax: null,
}));

/** The button whose whole text is `text` («Выдать» and not «Выдать и поместить на доску»). */
export function exactButton(host: HTMLElement, text: string): HTMLButtonElement {
  const button = [...host.querySelectorAll('button')].find(
    (candidate) => candidate.textContent.trim() === text,
  );
  if (button === undefined) {
    throw new Error(`Button "${text}" not found`);
  }
  return button;
}

/** A lesson of the student in `days` days, on a whole minute. */
export function lessonIn(days: number, studentId = 's-1') {
  const starts = new Date(Date.now() + days * DAY);
  starts.setSeconds(0, 0);
  return scheduledLesson({
    id: `l-${String(days)}`,
    studentId,
    participants: [{ studentId, studentName: null, studentAvatar: null, attendance: 'EXPECTED' }],
    startsAt: starts.toISOString(),
  });
}

/** The assignment editor of a test: the backend, the router spies and the page as it is opened. */
export class EditorHarness {
  backend!: HttpTestingController;
  navigate!: ReturnType<typeof vi.spyOn>;
  navigateByUrl!: ReturnType<typeof vi.spyOn>;
  fixture!: ComponentFixture<AssignmentEditorPage>;

  flushStatus(enabled: boolean): void {
    for (const request of this.backend.match('/api/teacher/ai/status')) {
      request.flush(aiStatus({ enabled }));
    }
  }

  flushGroups(): void {
    for (const request of this.backend.match((r) => r.url.startsWith('/api/teacher/groups'))) {
      request.flush([]);
    }
  }

  /**
   * The page as its route opens it: with the lessons ahead, which the route reads from the schedule
   * (ADR-0058) — here straight from the schedule's address.
   */
  open(): ComponentFixture<AssignmentEditorPage> {
    const http = TestBed.inject(HttpClient);
    this.fixture = TestBed.createComponent(AssignmentEditorPage);
    this.fixture.componentRef.setInput('upcomingLessons', (from: string, to: string) =>
      http.get<UpcomingLesson[]>('/api/teacher/schedule/lessons', { params: { from, to } }),
    );
    return this.fixture;
  }

  /** A new assignment with the students, these lessons ahead and the AI on or off. */
  async create(lessons = [scheduledLesson()], ai = false) {
    this.open();
    await this.fixture.whenStable();
    this.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    this.backend
      .expectOne((request) => request.url === '/api/teacher/schedule/lessons')
      .flush(lessons);
    this.flushStatus(ai);
    this.flushGroups();
    await this.fixture.whenStable();
    return { page: this.fixture.componentInstance, host: hostElement(this.fixture) };
  }

  /** The editor of a saved assignment. */
  async edit(details = assignmentDetails()) {
    this.fixture = TestBed.createComponent(AssignmentEditorPage);
    this.fixture.componentRef.setInput('assignmentId', details.id);
    await this.fixture.whenStable();
    this.backend.expectOne(`/api/teacher/homework/assignments/${details.id}`).flush(details);
    this.flushStatus(false);
    await this.fixture.whenStable();
    return { page: this.fixture.componentInstance, host: hostElement(this.fixture) };
  }

  /** The effects ran and an autosave with no delay went out. */
  async settle(): Promise<void> {
    await this.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await this.fixture.whenStable();
  }
}

/** Sets the editor up before each test of the enclosing `describe` and destroys it after. */
export function useEditorHarness(): EditorHarness {
  const harness = new EditorHarness();
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    harness.backend = TestBed.inject(HttpTestingController);
    harness.navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    harness.navigateByUrl = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    vi.spyOn(TestBed.inject(MessageService), 'add');
  });
  afterEach(() => {
    harness.fixture.destroy();
    vi.restoreAllMocks();
  });
  return harness;
}
