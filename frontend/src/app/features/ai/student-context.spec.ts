import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, menuItemByText, readableText } from '@testing/dom';
import { aStudent, aTag } from '@testing/identity-fixtures';
import { testProviders } from '@testing/setup';
import { AiContextChips, StudentContext } from './student-context';

const CLASS = aTag({
  id: 'class',
  name: 'Класс',
  values: [
    { id: 'c7', label: '7' },
    { id: 'c8', label: '8' },
  ],
});

describe('StudentContext', () => {
  let backend: HttpTestingController;
  let context: StudentContext;

  function load(): void {
    TestBed.configureTestingModule({ providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    context = TestBed.runInInjectionContext(() => new StudentContext());
    context.load();
    context.load();
  }

  afterEach(() => {
    backend.verify();
  });

  it('builds the chips of set AI tags, counts mixed values and keeps the choices', () => {
    load();
    backend
      .expectOne('/api/teacher/tags')
      .flush([aTag(), CLASS, aTag({ id: 'filter', name: 'Формат', useInAi: false })]);
    backend
      .expectOne('/api/teacher/students')
      .flush([
        aStudent({ id: 'a', tags: { 'tag-1': 'v-2', class: 'c7', filter: 'x' } }),
        aStudent({ id: 'b', tags: { class: 'c8' } }),
        aStudent({ id: 'c', tags: { class: 'c7' } }),
      ]);

    expect(context.context(['a', 'b', 'c', 'gone'])).toEqual([
      { name: 'Уровень', value: 'A2' },
      { name: 'Класс', value: '7 · 8' },
    ]);
    const mixed = context.chips(['a', 'b', 'c'])[1];
    expect(mixed?.mixed).toBe(true);
    expect(mixed?.shares).toEqual([
      { id: 'c7', label: '7', count: 2 },
      { id: 'c8', label: '8', count: 1 },
    ]);
    expect(context.chips(['a'])[1]?.mixed).toBe(false);
    expect(context.chips(['b'])).toHaveLength(1);

    context.pick('class', 'c8');
    expect(context.chips(['a', 'b', 'c'])[1]).toMatchObject({ value: '8', mixed: false });
    // a picked value the recipients no longer have gives way to all of theirs
    expect(context.context(['a'])[1]).toEqual({ name: 'Класс', value: '7' });
    context.pick('class', null);
    expect(context.context(['a', 'b'])[1]?.value).toBe('7 · 8');

    context.remove('tag-1');
    expect(context.context(['a', 'b'])).toEqual([{ name: 'Класс', value: '7 · 8' }]);
  });

  it('keeps to the limits of the request', () => {
    load();
    const tags = Array.from({ length: 12 }, (_, index) =>
      aTag({ id: `t${String(index)}`, name: `Тег ${String(index)}` }),
    );
    const long = aTag({
      id: 'long',
      values: Array.from({ length: 4 }, (_, index) => ({
        id: `l${String(index)}`,
        label: 'я'.repeat(40),
      })),
    });
    backend.expectOne('/api/teacher/tags').flush([long, ...tags]);
    backend.expectOne('/api/teacher/students').flush(
      Array.from({ length: 4 }, (_, index) =>
        aStudent({
          id: `s${String(index)}`,
          tags: Object.fromEntries<string>([
            ['long', `l${String(index)}`],
            ...tags.map((tag) => [tag.id, 'v-1'] as const),
          ]),
        }),
      ),
    );

    const items = context.context(['s0', 's1', 's2', 's3']);
    expect(items).toHaveLength(10);
    // all four would be 169 characters: the first value goes until the teacher picks one
    expect(items[0]?.value).toBe('я'.repeat(40));
    expect(context.chips(['s0', 's1'])[0]).toMatchObject({ mixed: true, all: true });
    expect(context.chips(['s0', 's1', 's2', 's3'])[0]).toMatchObject({ mixed: true, all: false });
  });

  it('takes the texts of a text tag as its values', () => {
    load();
    const hobby = aTag({ id: 'hobby', name: 'Интересы', kind: 'TEXT', values: [] });
    backend.expectOne('/api/teacher/tags').flush([hobby]);
    backend
      .expectOne('/api/teacher/students')
      .flush([
        aStudent({ id: 'a', tags: { hobby: 'футбол' } }),
        aStudent({ id: 'b', tags: { hobby: 'Minecraft' } }),
        aStudent({ id: 'c', tags: { hobby: 'футбол' } }),
        aStudent({ id: 'd', tags: {} }),
      ]);

    expect(context.context(['a', 'c', 'd'])).toEqual([{ name: 'Интересы', value: 'футбол' }]);
    expect(context.chips(['b', 'a', 'c'])[0]).toMatchObject({
      value: 'Minecraft · футбол',
      mixed: true,
      shares: [
        { id: 'Minecraft', label: 'Minecraft', count: 1 },
        { id: 'футбол', label: 'футбол', count: 2 },
      ],
    });
    context.pick('hobby', 'Minecraft');
    expect(context.context(['a', 'b'])).toEqual([{ name: 'Интересы', value: 'Minecraft' }]);
  });

  it('sends nothing when the tags do not load', () => {
    load();
    backend.expectOne('/api/teacher/tags').flush(null, { status: 500, statusText: 'Error' });
    backend.expectOne('/api/teacher/students').flush(null, { status: 500, statusText: 'Error' });

    expect(context.context(['a'])).toEqual([]);
  });
});

describe('AiContextChips', () => {
  let fixture: ComponentFixture<AiContextChips>;
  let backend: HttpTestingController;

  async function render(
    students: string[],
    row = false,
    tags = [aTag(), CLASS],
    profiles = [
      aStudent({ id: 'a', tags: { 'tag-1': 'v-1', class: 'c7' } }),
      aStudent({ id: 'b', tags: { class: 'c8' } }),
    ],
  ) {
    TestBed.configureTestingModule({ imports: [AiContextChips], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    const state = TestBed.runInInjectionContext(() => new StudentContext());
    fixture = TestBed.createComponent(AiContextChips);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('students', students);
    fixture.componentRef.setInput('row', row);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/tags').flush(tags);
    backend.expectOne('/api/teacher/students').flush(profiles);
    await fixture.whenStable();
    return { state, host: hostElement(fixture) };
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows a mixed value in the warning tone and picks one from its menu', async () => {
    const { state, host } = await render(['a', 'b']);

    expect(readableText(host)).toContain('Уровень: A1');
    expect(readableText(host)).toContain('у 1 — 7, у 1 — 8');
    const mixed = host.querySelector('.tb-ai-context__mixed');
    expect(mixed?.textContent).toContain('Класс: 7 · 8');
    expect(host.querySelectorAll('.tb-input-chip__menu')).toHaveLength(1);

    buttonByText(host, 'Класс: 7 · 8').click();
    await fixture.whenStable();
    menuItemByText('8 — у 1').click();
    await fixture.whenStable();
    expect(host.querySelector('.tb-ai-context__mixed')).toBeNull();
    expect(state.context(['a', 'b'])[1]?.value).toBe('8');

    buttonByText(host, 'Класс: 8').click();
    await fixture.whenStable();
    menuItemByText('Все: 7 · 8').click();
    await fixture.whenStable();
    expect(host.querySelector('.tb-ai-context__mixed')).not.toBeNull();
  });

  it('offers no «all» when the texts would not fit a request', async () => {
    const long = (letter: string) => letter.repeat(70);
    const { state } = await render(
      ['a', 'b'],
      false,
      [aTag({ id: 'hobby', name: 'Интересы', kind: 'TEXT', values: [] })],
      [
        aStudent({ id: 'a', tags: { hobby: long('a') } }),
        aStudent({ id: 'b', tags: { hobby: long('b') } }),
      ],
    );

    buttonByText(hostElement(fixture), `Интересы: ${long('a')}`).click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain(`${long('b')} — у 1`);
    expect(document.body.textContent).not.toContain('Все:');
    menuItemByText(`${long('b')} — у 1`).click();
    expect(state.context(['a', 'b'])).toEqual([{ name: 'Интересы', value: long('b') }]);
  });

  it('removes a chip for these requests and disappears with nothing to send', async () => {
    const { state, host } = await render(['a', 'b'], true);

    expect(host.querySelector('.tb-ai-context__chips--row')).not.toBeNull();
    host.querySelector<HTMLButtonElement>('[aria-label="Не учитывать: Уровень"]')?.click();
    host.querySelector<HTMLButtonElement>('[aria-label="Не учитывать: Класс"]')?.click();
    await fixture.whenStable();

    expect(state.context(['a', 'b'])).toEqual([]);
    expect(readableText(host)).not.toContain('Учитываю об учениках');
  });
});
