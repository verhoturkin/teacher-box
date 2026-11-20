import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { aCourse } from '@testing/textbooks-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { StudentGroup } from '@features/identity/parts';
import { GroupFormDialog } from './group-form-dialog';
import { testProviders } from '@testing/setup';

describe('GroupFormDialog', () => {
  let fixture: ComponentFixture<GroupFormDialog>;
  let backend: HttpTestingController;
  let created: { group: StudentGroup; courseId: string | null }[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GroupFormDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupFormDialog);
    created = [];
    fixture.componentInstance.created.subscribe((value) => created.push(value));
    fixture.componentRef.setInput('students', [
      aStudent({ id: 'a', displayName: 'Анна' }),
      aStudent({ id: 'o', displayName: 'Олег', status: 'DEACTIVATED' }),
    ]);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(): Promise<GroupFormDialog> {
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('creates a group of its name and students only', async () => {
    const dialog = await open();
    expect(bodyText()).toContain('Новая группа');
    expect(document.body.querySelector('#group-price')).toBeNull();
    expect(document.body.querySelector('#group-topic')).toBeNull();
    dialog.form.patchValue({ name: ' ОГЭ ', memberIds: ['a'] });

    buttonByText(document.body, 'Создать').click();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/groups' });
    expect(create.request.body).toEqual({
      name: 'ОГЭ',
      memberIds: ['a'],
      defaultTopic: null,
      color: null,
    });
    create.flush(aGroup({ id: 'g', name: 'ОГЭ' }));
    await fixture.whenStable();

    expect(created.map(({ group }) => group.id)).toEqual(['g']);
    expect(created[0]?.courseId).toBeNull();
    expect(document.body.querySelector('#group-course')).toBeNull();
    expect(dialog.visible()).toBe(false);
  });

  it('gives the new group its course; a refused course leaves the group without one', async () => {
    fixture.componentRef.setInput('courses', [aCourse({ id: 'a2', name: 'A2' })]);
    const dialog = await open();
    expect(document.body.querySelector('#group-course')).not.toBeNull();
    dialog.form.patchValue({ name: 'A2', courseId: 'a2' });
    buttonByText(document.body, 'Создать').click();
    backend.expectOne('/api/teacher/groups').flush(aGroup({ id: 'g' }));
    const link = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/textbooks/groups/g/course',
    });
    expect(link.request.body).toEqual({ courseId: 'a2' });
    link.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(created.map(({ courseId }) => courseId)).toEqual(['a2']);

    await open();
    dialog.form.patchValue({ name: 'B1', courseId: 'a2' });
    buttonByText(document.body, 'Создать').click();
    backend.expectOne('/api/teacher/groups').flush(aGroup({ id: 'g2' }));
    backend
      .expectOne('/api/teacher/textbooks/groups/g2/course')
      .flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(created.map(({ courseId }) => courseId)).toEqual(['a2', null]);
    expect(dialog.visible()).toBe(false);
  });

  it('offers the current students only', async () => {
    const dialog = await open();
    expect(dialog.memberOptions().map((student) => student.id)).toEqual(['a']);
  });

  it('needs a name', async () => {
    const dialog = await open();
    buttonByText(document.body, 'Создать').click();
    backend.expectNone('/api/teacher/groups');
    expect(dialog.form.controls.name.touched).toBe(true);
  });

  it('starts empty each time it opens', async () => {
    const dialog = await open();
    dialog.form.patchValue({ name: 'Черновик', memberIds: ['a'] });
    dialog.visible.set(false);
    await fixture.whenStable();
    await open();
    expect(dialog.form.getRawValue()).toEqual({ name: '', memberIds: [], courseId: null });
  });

  it('shows why the group was not created and stays open', async () => {
    const dialog = await open();
    dialog.form.patchValue({ name: 'ОГЭ' });
    buttonByText(document.body, 'Создать').click();
    backend
      .expectOne('/api/teacher/groups')
      .flush({ status: 500 }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Не удалось сохранить');
    expect(dialog.visible()).toBe(true);
    expect(created).toEqual([]);
  });
});
