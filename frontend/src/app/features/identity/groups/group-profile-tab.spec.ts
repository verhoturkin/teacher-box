import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText, requireElement, typeInto } from '@testing/dom';
import { aGroup } from '@testing/identity-fixtures';
import { testProviders } from '@testing/setup';
import { StudentGroup } from '../data-access/identity.models';
import { GroupProfileTab } from './group-profile-tab';

const OGE = aGroup({
  id: 'g',
  name: 'ОГЭ',
  defaultTopic: 'Дроби',
  color: 'GREEN',
  members: [{ id: 'm', displayName: 'Мария', status: 'ACTIVE' }],
  version: 2,
});

describe('GroupProfileTab', () => {
  let fixture: ComponentFixture<GroupProfileTab>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(group: StudentGroup = OGE): Promise<void> {
    TestBed.configureTestingModule({ imports: [GroupProfileTab], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GroupProfileTab);
    fixture.componentRef.setInput('group', group);
    host = hostElement(fixture);
    await fixture.whenStable();
    await flushParts();
  }

  /** The price card and the room panel read their own data: their specs check them. */
  async function flushParts(): Promise<void> {
    backend.match('/api/teacher/billing/groups').forEach((request) => {
      request.flush({ currency: 'RUB', prices: [{ groupId: 'g', lessonPrice: 80_000 }] });
    });
    for (const request of backend.match((request) => request.url.includes('/meetings/'))) {
      request.flush(request.request.url.endsWith('/calls') ? { status: 'OFF', rooms: [] } : []);
    }
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  function field(id: string): HTMLInputElement {
    return requireElement(host, `#${id}`, HTMLInputElement);
  }

  function save(): HTMLButtonElement {
    return buttonByText(requireElement(host, 'form', HTMLFormElement), 'Сохранить');
  }

  it('lays the profile out as cards: data, price of each member, video meeting', async () => {
    await render();
    const titles = Array.from(host.querySelectorAll('.p-card-title')).map((title) =>
      title.textContent.trim(),
    );

    expect(titles).toEqual(['Данные группы', 'Цена занятия', 'Видеовстреча']);
    expect(field('group-profile-name').value).toBe('ОГЭ');
    expect(field('group-profile-topic').value).toBe('Дроби');
    expect(
      requireElement(host, 'tb-label-color-field .p-select', HTMLElement).textContent,
    ).toContain('Зелёный');
    expect(readableText(host)).toContain('Спишется с каждого');
  });

  it('keeps «Сохранить» off until a field changes; «Отмена» brings the saved ones back', async () => {
    await render();
    expect(save().disabled).toBe(true);

    typeInto(field('group-profile-topic'), 'Степени');
    await fixture.whenStable();
    expect(save().disabled).toBe(false);

    buttonByText(requireElement(host, 'form', HTMLFormElement), 'Отмена').click();
    await fixture.whenStable();
    expect(field('group-profile-topic').value).toBe('Дроби');
    expect(save().disabled).toBe(true);
  });

  it('saves the fields in place with the members and the version of the group', async () => {
    await render();
    const saved: StudentGroup[] = [];
    fixture.componentInstance.saved.subscribe((group) => saved.push(group));

    typeInto(field('group-profile-name'), ' ОГЭ 9 класс ');
    typeInto(field('group-profile-topic'), ' ');
    await fixture.whenStable();
    save().click();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/groups/g' });
    expect(request.request.body).toEqual({
      name: 'ОГЭ 9 класс',
      memberIds: ['m'],
      defaultTopic: null,
      color: 'GREEN',
      version: 2,
    });
    const response = { ...OGE, name: 'ОГЭ 9 класс', defaultTopic: null, version: 3 };
    request.flush(response);
    await fixture.whenStable();
    await flushParts();

    expect(saved).toEqual([response]);
  });

  it('fills the form again with a newer version of the group', async () => {
    await render();
    typeInto(field('group-profile-topic'), 'Степени');
    fixture.componentRef.setInput('group', { ...OGE, defaultTopic: 'Корни', version: 3 });
    await fixture.whenStable();

    expect(field('group-profile-topic').value).toBe('Корни');
    expect(save().disabled).toBe(true);
  });

  it('shows why it was not saved and keeps the form', async () => {
    await render();
    typeInto(field('group-profile-topic'), 'Степени');
    await fixture.whenStable();
    save().click();

    backend
      .expectOne('/api/teacher/groups/g')
      .flush({ status: 500 }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(readableText(host)).toContain('Не удалось сохранить');
    expect(field('group-profile-topic').value).toBe('Степени');
  });

  it('does not save an empty name', async () => {
    await render();
    typeInto(field('group-profile-name'), '');
    await fixture.whenStable();
    requireElement(host, 'form', HTMLFormElement).requestSubmit();

    backend.expectNone('/api/teacher/groups/g');
  });

  it('has no video meeting for an archived group', async () => {
    await render({ ...OGE, archivedAt: '2026-09-02T10:00:00Z' });

    expect(readableText(host)).not.toContain('Видеовстреча');
  });
});
