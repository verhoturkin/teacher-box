import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { bodyText, buttonByText } from '@testing/dom';
import { StudentGroup } from '../data-access/identity.models';
import { GroupFormDialog } from './group-form-dialog';
import { testProviders } from '@testing/setup';

describe('GroupFormDialog', () => {
  let fixture: ComponentFixture<GroupFormDialog>;
  let backend: HttpTestingController;
  let created: StudentGroup[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GroupFormDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupFormDialog);
    created = [];
    fixture.componentInstance.created.subscribe((group) => created.push(group));
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

    expect(created.map((group) => group.id)).toEqual(['g']);
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
    expect(dialog.form.getRawValue()).toEqual({ name: '', memberIds: [] });
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
