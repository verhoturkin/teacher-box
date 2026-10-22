import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MultiSelect } from 'primeng/multiselect';
import { Snackbar } from '@core/snackbar/snackbar';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { aGroup, aStudent } from '@testing/identity-fixtures';
import { testProviders } from '@testing/setup';
import { StudentGroup } from '../data-access/identity.models';
import { GroupMembersTab } from './group-members-tab';

const OGE = aGroup({
  id: 'g',
  name: 'ОГЭ',
  defaultTopic: 'Дроби',
  members: [
    { id: 'm', displayName: 'Мария', status: 'ACTIVE' },
    { id: 'b', displayName: 'Борис', status: 'INVITED' },
  ],
  version: 4,
});

const STUDENTS = [
  aStudent({ id: 'm', displayName: 'Мария', color: 'BLUE', avatar: '/photo/m' }),
  aStudent({ id: 'b', displayName: 'Борис', status: 'INVITED' }),
  aStudent({ id: 'v', displayName: 'Вера' }),
  aStudent({ id: 'o', displayName: 'Олег', status: 'DEACTIVATED' }),
];

describe('GroupMembersTab', () => {
  let fixture: ComponentFixture<GroupMembersTab>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let saved: StudentGroup[];
  let success: ReturnType<typeof vi.spyOn>;

  async function render(group: StudentGroup = OGE): Promise<void> {
    TestBed.configureTestingModule({ imports: [GroupMembersTab], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    fixture = TestBed.createComponent(GroupMembersTab);
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('students', STUDENTS);
    saved = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    host = hostElement(fixture);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function rows(): string[] {
    return Array.from(host.querySelectorAll('ul.tb-list > li')).map((row) => readableText(row));
  }

  it('lists the members by name, each a link to the card, with their colour and status', async () => {
    await render();

    expect(rows()).toEqual(['Б Борис Приглашён', 'Мария']);
    const maria = host.querySelectorAll('ul.tb-list > li')[1];
    expect(maria?.hasAttribute('data-tb-label')).toBe(false);
    expect(maria?.querySelector('tb-avatar')?.getAttribute('data-tb-label')).toBe('blue');
    expect(maria?.querySelector('a')?.getAttribute('href')).toBe('/teacher/students/m');
  });

  it('removes a member in place', async () => {
    await render();

    buttonByText(host, 'Убрать из группы: Борис').click();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/groups/g' });
    expect(request.request.body).toEqual({
      name: 'ОГЭ',
      memberIds: ['m'],
      defaultTopic: 'Дроби',
      color: null,
      version: 4,
    });
    const response: StudentGroup = { ...OGE, members: OGE.members.slice(0, 1), version: 5 };
    request.flush(response);
    await fixture.whenStable();

    expect(saved).toEqual([response]);
    expect(success).toHaveBeenCalledWith('Борис больше не в группе');
  });

  it('adds the chosen current students who are not in the group', async () => {
    await render();
    const tab = fixture.componentInstance;
    const add = (): HTMLButtonElement =>
      buttonByText(requireElement(host, 'form', HTMLFormElement), 'Добавить');
    expect(add().disabled).toBe(true);

    tab.chosen.setValue(['v']);
    await fixture.whenStable();
    expect(add().disabled).toBe(false);
    add().click();

    const request = backend.expectOne('/api/teacher/groups/g');
    expect(request.request.body).toEqual(expect.objectContaining({ memberIds: ['m', 'b', 'v'] }));
    request.flush(OGE);
    await fixture.whenStable();

    expect(tab.chosen.value).toEqual([]);
    expect(success).toHaveBeenCalledWith('Участники добавлены');
  });

  it('offers only current students who are not members', async () => {
    await render();

    const select = fixture.debugElement.query(By.directive(MultiSelect)).injector.get(MultiSelect);
    expect(select.options).toEqual([STUDENTS[2]]);
  });

  it('says when the group is empty and when nobody is left to add', async () => {
    await render({ ...OGE, members: [] });
    expect(readableText(host)).toContain('В группе пока никого');

    fixture.componentRef.setInput('students', [STUDENTS[0]]);
    fixture.componentRef.setInput('group', OGE);
    await fixture.whenStable();
    expect(readableText(host)).toContain('Все ученики уже в группе');
  });

  it('shows why the members were not saved', async () => {
    await render();

    buttonByText(host, 'Убрать из группы: Мария').click();
    backend
      .expectOne('/api/teacher/groups/g')
      .flush({ status: 500 }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(host)).toContain('Не удалось сохранить');
    expect(saved).toEqual([]);
  });
});
