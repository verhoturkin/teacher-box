import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileOpener } from '@shared/files/file-opener';
import { FileSaver } from '@shared/files/file-saver';
import { buttonByText, hostElement } from '@testing/dom';
import { CHILD_ID, familyScopeOf } from '@testing/family-fixtures';
import { testProviders } from '@testing/setup';
import { scheduledLesson } from '@testing/schedule-fixtures';
import { ScheduledLesson, StudentLessonPlan } from '../data-access/schedule.models';
import { MyLessonPlan } from './my-lesson-plan';

const PLAN: StudentLessonPlan = {
  id: 'p-7',
  title: 'Present Simple',
  body: '1. **Разминка**',
  textbooks: [
    { id: 'tb-1', title: 'Spotlight 5', kind: 'TEXTBOOK', format: 'PDF', pages: '12-14' },
  ],
  videos: [
    {
      url: 'https://youtu.be/abc',
      provider: 'YOUTUBE',
      videoId: 'abc',
      startSeconds: null,
      title: 'Song',
      transcript: '[0:01] Hello',
      transcriptShown: true,
    },
  ],
};

describe('MyLessonPlan', () => {
  let fixture: ComponentFixture<MyLessonPlan>;
  let backend: HttpTestingController;

  function create(family = false): void {
    TestBed.configureTestingModule({
      providers: family ? [...testProviders(), familyScopeOf()] : testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyLessonPlan);
  }

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  async function show(lesson: ScheduledLesson): Promise<HTMLElement> {
    fixture.componentRef.setInput('lesson', lesson);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('shows nothing for a lesson without a plan', async () => {
    create();
    const root = await show(scheduledLesson({ planId: null }));
    expect(root.querySelector('section')).toBeNull();
  });

  it('reads the plan once and shows its text, textbook pages and videos', async () => {
    create();
    const opener = vi.spyOn(TestBed.inject(FileOpener), 'open').mockImplementation(() => undefined);
    const saver = vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation(() => undefined);
    const lesson = scheduledLesson({ id: 'l-1', planId: 'p-7' });
    const root = await show(lesson);
    backend.expectOne('/api/me/schedule/lessons/l-1/plan').flush(PLAN);
    await fixture.whenStable();
    expect(root.textContent).toContain('План урока');
    expect(root.textContent).toContain('Present Simple');
    expect(root.querySelector('strong')?.textContent).toBe('Разминка');
    expect(root.textContent).toContain('Spotlight 5');
    expect(root.textContent).toContain('Song');
    expect(root.textContent).toContain('Расшифровка');

    // the same lesson again (a new object of the page) reads nothing
    await show({ ...lesson });
    backend.expectNone('/api/me/schedule/lessons/l-1/plan');

    root.querySelector<HTMLButtonElement>('.tb-link-button')?.click();
    expect(opener).toHaveBeenCalledWith(expect.anything(), true, expect.any(Function));
    const [content, , filename] = opener.mock.calls[0] ?? [];
    content?.subscribe(() => undefined);
    backend
      .expectOne('/api/me/schedule/lessons/l-1/plan/textbooks/tb-1')
      .flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(filename?.(new Blob([], { type: 'application/pdf' }))).toBe(
      'Spotlight 5 (с. 12-14).pdf',
    );

    root.querySelector<HTMLButtonElement>('.tb-list__trail button')?.click();
    backend
      .expectOne('/api/me/schedule/lessons/l-1/plan/textbooks/tb-1')
      .flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(saver).toHaveBeenCalledWith(expect.any(Blob), 'Spotlight 5 (с. 12-14).pdf');

    await show({ ...lesson, planId: null });
    expect(root.querySelector('section')).toBeNull();
  });

  it('reads a child’s plan in the family cabinet and retries a failed read', async () => {
    create(true);
    const root = await show(scheduledLesson({ id: 'l-1', planId: 'p-7' }));
    const url = `/api/guardian/students/${CHILD_ID}/schedule/lessons/l-1/plan`;
    backend.expectOne(url).flush({ status: 500 }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    buttonByText(root, 'Повторить').click();
    backend.expectOne(url).flush({ ...PLAN, body: '', textbooks: [], videos: [] });
    await fixture.whenStable();
    expect(root.textContent).toContain('Present Simple');
    expect(root.textContent).not.toContain('Учебники');
  });
});
