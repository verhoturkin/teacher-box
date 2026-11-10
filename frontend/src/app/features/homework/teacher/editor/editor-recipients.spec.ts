import { TestBed } from '@angular/core/testing';
import { assignmentDetails } from '@testing/homework-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { groupLesson } from '@testing/schedule-fixtures';
import { By } from '@angular/platform-browser';
import { DAY, EDITOR_STUDENTS, exactButton, useEditorHarness } from '@testing/homework-editor';
import { AssignMoreDialog } from '../assign-more-dialog';
import { AssignmentEditorPage } from '../assignment-editor-page';

describe('AssignmentEditorPage: «Кому · Срок»', () => {
  const editor = useEditorHarness();

  it('offers the next lesson of the chosen students', async () => {
    const { page, host } = await editor.create([
      groupLesson({ startsAt: new Date(Date.now() + DAY).toISOString() }),
    ]);
    expect(readableText(host)).not.toContain('К следующему занятию');

    page.form.patchValue({ members: [{ kind: 'STUDENT', id: 's-2' }] });
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('К следующему занятию');
    buttonByText(host, 'Без срока').click();
    expect(page.canLeave()).toBe(true);
  });

  it('works without the schedule', async () => {
    editor.fixture = TestBed.createComponent(AssignmentEditorPage);
    await editor.fixture.whenStable();
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.backend
      .expectOne((request) => request.url === '/api/teacher/schedule/lessons')
      .flush(null, { status: 500, statusText: 'Error' });
    editor.flushStatus(false);
    editor.flushGroups();
    editor.fixture.componentInstance.form.patchValue({ members: [{ kind: 'STUDENT', id: 's-1' }] });
    await editor.fixture.whenStable();

    expect(readableText(hostElement(editor.fixture))).not.toContain('К следующему занятию');
  });

  it('shows the students of a draft as chips and keeps them as it saves itself', async () => {
    const { page, host } = await editor.edit(
      assignmentDetails({ tasks: [], draftStudentIds: ['s-1'], attachments: [] }),
    );
    page.autosaveDelay = 0;
    editor.backend.expectOne('/api/teacher/students').flush(EDITOR_STUDENTS);
    editor.flushGroups();
    await editor.settle();
    editor.backend.expectNone({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' });

    expect(page.form.controls.members.value).toEqual([{ kind: 'STUDENT', id: 's-1' }]);
    expect(host.querySelector('tb-recipients-field')).not.toBeNull();
    expect(readableText(host)).toContain('Анна');
    expect(() => exactButton(host, 'Сохранить')).toThrow();

    page.form.controls.members.setValue([{ kind: 'STUDENT', id: 's-2' }]);
    await editor.settle();
    editor.backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' })
      .flush(assignmentDetails({ tasks: [], version: 1 }));
    const kept = editor.backend.expectOne('/api/teacher/homework/assignments/a-1/draft-students');
    expect(kept.request.body).toEqual({ studentIds: ['s-2'] });
    kept.flush(assignmentDetails({ tasks: [], version: 1 }));
    await editor.settle();
    expect(editor.navigate).not.toHaveBeenCalled();
  });

  it('leaves the students of a draft alone until the list of students is in', async () => {
    const { page } = await editor.edit(
      assignmentDetails({ tasks: [], draftStudentIds: ['s-1'], attachments: [] }),
    );
    page.autosaveDelay = 0;
    page.form.patchValue({ description: 'Дроби\nНовое' });
    await editor.settle();
    editor.backend
      .expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' })
      .flush(assignmentDetails({ tasks: [], version: 1 }));
    editor.backend.expectNone('/api/teacher/homework/assignments/a-1/draft-students');
  });

  it('shows the students of an issued assignment read-only and gives it to more', async () => {
    const { host } = await editor.edit(assignmentDetails());

    expect(host.querySelector('tb-recipients-field')).toBeNull();
    expect(host.querySelector('tb-input-chip')?.textContent).toContain('Анна');
    expect(host.querySelector('tb-input-chip button')).toBeNull();

    buttonByText(host, 'Выдать ещё').click();
    await editor.fixture.whenStable();
    const more = editor.fixture.debugElement
      .query(By.directive(AssignMoreDialog))
      .injector.get(AssignMoreDialog);
    expect(more.visible()).toBe(true);
    const issued = assignmentDetails();
    const first = issued.tasks[0];
    if (first === undefined) {
      throw new Error('no task in the editor.fixture');
    }
    more.saved.emit({
      ...issued,
      version: 3,
      tasks: [...issued.tasks, { ...first, taskId: 't-2', studentId: 's-2', studentName: 'Борис' }],
    });
    await editor.fixture.whenStable();
    expect(readableText(host)).toContain('Борис');
  });
});
