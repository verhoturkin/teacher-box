import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { bodyText } from '@testing/dom';
import { GroupFormDialog, SavedGroup } from './group-form-dialog';

describe('GroupFormDialog', () => {
  let fixture: ComponentFixture<GroupFormDialog>;
  let backend: HttpTestingController;
  let saved: SavedGroup[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [GroupFormDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupFormDialog);
    saved = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
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

  it('creates a group and sets its price', async () => {
    const dialog = await open();
    expect(bodyText()).toContain('Новая группа');
    dialog.form.patchValue({ name: 'ОГЭ', memberIds: ['a'], price: 800 });

    dialog.save();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/groups' });
    expect(create.request.body).toEqual({ name: 'ОГЭ', memberIds: ['a'] });
    create.flush(aGroup({ id: 'g', name: 'ОГЭ' }));
    const price = backend.expectOne({ method: 'PUT', url: '/api/teacher/billing/groups/g/price' });
    expect(price.request.body).toEqual({ lessonPrice: 80000 });
    price.flush({ groupId: 'g', lessonPrice: 80000 });

    expect(saved).toEqual([{ group: aGroup({ id: 'g', name: 'ОГЭ' }), lessonPrice: 80000 }]);
    expect(dialog.visible()).toBe(false);
  });

  it('keeps the price when it did not change', async () => {
    const group = aGroup({ id: 'g', version: 3 });
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('lessonPrice', 90000);
    const dialog = await open();
    expect(dialog.form.getRawValue()).toEqual({ name: 'ОГЭ 9 класс', memberIds: ['student-1', 'student-2'], price: 900 });
    dialog.form.patchValue({ name: 'ОГЭ 9Б' });

    dialog.save();
    const update = backend.expectOne({ method: 'PUT', url: '/api/teacher/groups/g' });
    expect(update.request.body).toEqual({ name: 'ОГЭ 9Б', memberIds: ['student-1', 'student-2'], version: 3 });
    update.flush({ ...group, name: 'ОГЭ 9Б', version: 4 });

    expect(saved[0]?.lessonPrice).toBe(90000);
  });

  it('does not change the price when it is left empty', async () => {
    const dialog = await open();
    dialog.form.patchValue({ name: 'Без цены' });

    dialog.save();
    backend.expectOne('/api/teacher/groups').flush(aGroup({ id: 'g' }));

    expect(saved[0]?.lessonPrice).toBeNull();
  });

  it('offers current students and keeps members who left', async () => {
    fixture.componentRef.setInput(
      'group',
      aGroup({ members: [{ id: 'o', displayName: 'Олег', status: 'DEACTIVATED' }, { id: 'x', displayName: 'Ксения', status: 'DEACTIVATED' }] }),
    );
    await open();

    expect(fixture.componentInstance.memberOptions().map((option) => option.id)).toEqual(['a', 'o', 'x']);
  });

  it('shows why the group was not saved', async () => {
    const dialog = await open();
    dialog.form.patchValue({ name: 'Ошибка' });

    dialog.save();
    backend
      .expectOne('/api/teacher/groups')
      .flush({ status: 422, code: 'group.member-invalid' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(bodyText()).toContain('В группу можно добавить только учеников с доступом к порталу');
    expect(dialog.visible()).toBe(true);
    expect(saved).toEqual([]);
  });

  it('does not save an invalid form twice', async () => {
    const dialog = await open();
    dialog.save();
    backend.expectNone('/api/teacher/groups');
  });
});
