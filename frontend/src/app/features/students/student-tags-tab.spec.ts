import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aStudent, aTag } from '@testing/identity-fixtures';
import { hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Student } from '@features/identity/parts';
import { StudentTagsTab } from './student-tags-tab';

const LEVEL = aTag({
  id: 'level',
  name: 'Уровень английского',
  values: [
    { id: 'a1', label: 'A1' },
    { id: 'b1', label: 'B1' },
  ],
});
const FORMAT = aTag({
  id: 'format',
  name: 'Формат',
  useInAi: false,
  values: [{ id: 'online', label: 'Онлайн' }],
});

describe('StudentTagsTab', () => {
  let fixture: ComponentFixture<StudentTagsTab>;
  let backend: HttpTestingController;
  let host: HTMLElement;
  let saved: Student[];

  async function create(student: Student, tags = [LEVEL, FORMAT]): Promise<void> {
    TestBed.configureTestingModule({ imports: [StudentTagsTab], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentTagsTab);
    fixture.componentRef.setInput('student', student);
    saved = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    host = hostElement(fixture);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/tags').flush(tags);
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
  });

  it('offers to create tags when there are none', async () => {
    await create(aStudent(), []);
    expect(host.textContent).toContain('Тегов пока нет');
    const link = host.querySelector<HTMLAnchorElement>('tb-empty-state a');
    expect(link?.textContent).toContain('Создать теги');
    expect(link?.getAttribute('href')).toBe('/teacher/settings/students');
  });

  it('shows a row per tag, the AI ones marked, and what the AI will see', async () => {
    await create(aStudent({ tags: { level: 'b1' } }));

    const rows = Array.from(host.querySelectorAll('li.tb-tile'));
    expect(rows.map((row) => readableText(row))).toEqual([
      expect.stringContaining('Уровень английского Учитывает ИИ'),
      expect.stringContaining('Формат Только для фильтра в списке'),
    ]);
    expect(rows[0]?.querySelector('.tb-i-auto_awesome')).not.toBeNull();
    expect(rows[1]?.querySelector('.tb-i-sell')).not.toBeNull();
    expect(host.textContent).toContain('Что увидит ИИ');
    expect(host.querySelector('.tb-student-tags__chip')?.textContent).toContain(
      'Уровень английского: B1',
    );
    expect(host.querySelector('a[href="/teacher/settings/students"]')).not.toBeNull();
  });

  it('says so when the AI gets nothing from the student', async () => {
    await create(aStudent());
    expect(host.textContent).toContain('ни один тег, который учитывает ИИ');
  });

  it('saves the whole set on choosing and reports the student', async () => {
    await create(aStudent({ id: 'm', tags: { format: 'online' } }));

    fixture.componentInstance.choose(LEVEL, 'a1');
    const request = backend.expectOne('/api/teacher/students/m/tags');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ format: 'online', level: 'a1' });
    const student = aStudent({ id: 'm', tags: { format: 'online', level: 'a1' } });
    request.flush(student);
    await fixture.whenStable();
    expect(saved).toEqual([student]);
    expect(host.querySelector('.tb-student-tags__chip')?.textContent).toContain('A1');
  });

  it('clears a tag with «Не задан» and puts the old value back when saving fails', async () => {
    await create(aStudent({ id: 'm', tags: { level: 'b1' } }));

    fixture.componentInstance.choose(LEVEL, null);
    const request = backend.expectOne('/api/teacher/students/m/tags');
    expect(request.request.body).toEqual({});
    request.flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(saved).toEqual([]);
    expect(host.querySelector('.tb-student-tags__chip')?.textContent).toContain('B1');
  });

  it('saves the text of a free-text tag on blur and Enter, a blank one clears it', async () => {
    const hobby = aTag({ id: 'hobby', name: 'Интересы', kind: 'TEXT', values: [] });
    const note = aTag({ id: 'note', name: 'Заметка', kind: 'TEXT', values: [], useInAi: false });
    await create(aStudent({ id: 'm', tags: { hobby: 'футбол' } }), [hobby, note]);

    expect(readableText(host)).toContain('Заметка Заметка для вас');
    expect(host.querySelector('.tb-student-tags__chip')?.textContent).toContain('Интересы: футбол');
    const field = host.querySelector<HTMLInputElement>('#tag-text-hobby');
    if (field === null) {
      throw new Error('no text field');
    }
    expect(field.value).toBe('футбол');
    expect(field.maxLength).toBe(120);
    expect(field.closest('.tb-field')?.querySelector('label')?.textContent).toBe('Текст');

    // unchanged — nothing to save
    field.dispatchEvent(new Event('blur'));
    backend.expectNone('/api/teacher/students/m/tags');

    field.value = '  футбол, Minecraft ';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    field.dispatchEvent(new Event('blur'));
    const request = backend.expectOne('/api/teacher/students/m/tags');
    expect(request.request.body).toEqual({ hobby: 'футбол, Minecraft' });
    expect(field.value).toBe('футбол, Minecraft');
    request.flush(aStudent({ id: 'm', tags: { hobby: 'футбол, Minecraft' } }));
    await fixture.whenStable();
    expect(host.querySelector('.tb-student-tags__chip')?.textContent).toContain(
      'Интересы: футбол, Minecraft',
    );

    field.value = ' ';
    field.dispatchEvent(new Event('blur'));
    expect(backend.expectOne('/api/teacher/students/m/tags').request.body).toEqual({});
  });
});
