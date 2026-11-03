import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService } from 'primeng/api';
import { aStudent, aTag } from '@testing/identity-fixtures';
import { bodyText, buttonByText, typeInto } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { TagChanged } from '../data-access/identity.models';
import { TagDialog } from './tag-dialog';

describe('TagDialog', () => {
  let fixture: ComponentFixture<TagDialog>;
  let backend: HttpTestingController;
  let saved: TagChanged[];
  let deleted: TagChanged[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [TagDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TagDialog);
    saved = [];
    deleted = [];
    fixture.componentInstance.saved.subscribe((changed) => saved.push(changed));
    fixture.componentInstance.deleted.subscribe((changed) => deleted.push(changed));
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(): Promise<TagDialog> {
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  function addValue(label: string): void {
    const field = document.body.querySelector<HTMLInputElement>('#tag-new-value');
    if (field === null) {
      throw new Error('no field for a new value');
    }
    typeInto(field, label);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  function labels(): string[] {
    return Array.from(document.body.querySelectorAll('.tb-input-chip__label')).map((chip) =>
      chip.textContent.trim(),
    );
  }

  function press(handle: Element | undefined, key: string): void {
    handle?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('creates a tag from the values in the order they were added', async () => {
    const dialog = await open();
    expect(bodyText()).toContain('Новый тег');
    dialog.form.patchValue({ name: ' Класс ' });
    addValue('5');
    addValue(' 6 ');
    addValue('5');
    await fixture.whenStable();
    expect(labels()).toEqual(['5', '6']);

    buttonByText(document.body, 'Создать').click();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/tags' });
    expect(create.request.body).toEqual({
      name: 'Класс',
      kind: 'LIST',
      useInAi: true,
      values: ['5', '6'],
    });
    create.flush(aTag({ id: 'new', name: 'Класс' }));
    await fixture.whenStable();

    expect(saved.map((changed) => changed.tag.id)).toEqual(['new']);
    expect(dialog.visible()).toBe(false);
  });

  it('needs a name and a value', async () => {
    const dialog = await open();
    buttonByText(document.body, 'Создать').click();
    await fixture.whenStable();

    backend.expectNone('/api/teacher/tags');
    expect(dialog.form.controls.name.touched).toBe(true);
    expect(bodyText()).toContain('Добавьте хотя бы одно значение');
  });

  it('edits a tag: keeps the ids of the kept values, reorders and removes', async () => {
    fixture.componentRef.setInput('tag', aTag({ version: 3 }));
    const dialog = await open();
    backend.expectOne('/api/teacher/students').flush([aStudent()]);
    expect(labels()).toEqual(['A1', 'A2']);
    expect(document.body.querySelector<HTMLInputElement>('#tag-name')?.value).toBe('Уровень');

    const handles = document.body.querySelectorAll('.tb-tag-handle');
    press(handles[0], 'ArrowLeft');
    press(handles[0], 'Enter');
    press(handles[0], 'ArrowRight');
    await fixture.whenStable();
    expect(labels()).toEqual(['A2', 'A1']);
    press(document.body.querySelectorAll('.tb-tag-handle')[1], 'ArrowRight');
    expect(labels()).toEqual(['A2', 'A1']);

    document.body.querySelector<HTMLButtonElement>('.tb-input-chip__remove')?.click();
    dialog.form.patchValue({ useInAi: false });
    await fixture.whenStable();
    buttonByText(document.body, 'Сохранить').click();
    const update = backend.expectOne({ method: 'PUT', url: '/api/teacher/tags/tag-1' });
    expect(update.request.body).toEqual({
      name: 'Уровень',
      kind: 'LIST',
      useInAi: false,
      values: [{ id: 'v-1', label: 'A1' }],
      version: 3,
    });
    update.flush({ tag: aTag({ version: 4 }), clearedStudents: 2 });
    await fixture.whenStable();

    expect(saved[0]?.clearedStudents).toBe(2);
  });

  it('creates a free-text tag without values', async () => {
    const dialog = await open();
    dialog.form.patchValue({ name: 'Интересы', kind: 'TEXT' });
    await fixture.whenStable();
    expect(document.body.querySelector('#tag-new-value')).toBeNull();
    expect(bodyText()).toContain('свой текст до 120 символов');

    buttonByText(document.body, 'Создать').click();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/tags' });
    expect(create.request.body).toEqual({
      name: 'Интересы',
      kind: 'TEXT',
      useInAi: true,
      values: [],
    });
    create.flush(aTag({ id: 'new', kind: 'TEXT', values: [] }));
  });

  it('turns an unused list tag into a text one, sending no values', async () => {
    fixture.componentRef.setInput('tag', aTag());
    const dialog = await open();
    backend.expectOne('/api/teacher/students').flush([aStudent({ tags: { other: 'x' } })]);
    expect(dialog.form.controls.kind.enabled).toBe(true);

    dialog.form.patchValue({ kind: 'TEXT' });
    buttonByText(document.body, 'Сохранить').click();
    const update = backend.expectOne({ method: 'PUT', url: '/api/teacher/tags/tag-1' });
    expect(update.request.body).toMatchObject({ kind: 'TEXT', values: [] });
    update.flush({ code: 'tag.kind-used', status: 409 }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    // a student got the tag meanwhile: the server's reason stays in the dialog
    expect(bodyText()).toContain('Тег уже задан ученикам');
    expect(dialog.visible()).toBe(true);
  });

  it('locks the kind of a tag set on a student', async () => {
    fixture.componentRef.setInput('tag', aTag({ kind: 'TEXT', values: [] }));
    const dialog = await open();
    backend.expectOne('/api/teacher/students').flush([aStudent({ tags: { 'tag-1': 'футбол' } })]);
    await fixture.whenStable();

    expect(dialog.form.controls.kind.disabled).toBe(true);
    expect(bodyText()).toContain('поэтому его тип не изменить');
    expect(document.body.querySelector('.tb-tag-note')).toBeNull();
    buttonByText(document.body, 'Сохранить').click();
    expect(
      backend.expectOne({ method: 'PUT', url: '/api/teacher/tags/tag-1' }).request.body,
    ).toMatchObject({ kind: 'TEXT', values: [] });
  });

  it('deletes a tag after the confirmation only', async () => {
    fixture.componentRef.setInput('tag', aTag());
    const dialog = await open();
    backend.expectOne('/api/teacher/students').flush(null, { status: 500, statusText: 'Error' });
    const ask = vi.spyOn(TestBed.inject(ConfirmationService), 'confirm');

    buttonByText(document.body, 'Удалить тег').click();
    const refused = ask.mock.calls[0]?.[0];
    expect(refused?.header).toBe('Удалить тег «Уровень»?');
    refused?.reject?.();
    await fixture.whenStable();
    backend.expectNone('/api/teacher/tags/tag-1');

    buttonByText(document.body, 'Удалить тег').click();
    ask.mock.calls[1]?.[0].accept?.();
    await fixture.whenStable();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/tags/tag-1' }).flush({
      clearedStudents: 3,
    });

    expect(deleted.map((changed) => changed.clearedStudents)).toEqual([3]);
    expect(dialog.visible()).toBe(false);
  });
});
