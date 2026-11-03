import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aTag } from '@testing/identity-fixtures';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { StudentTag } from '../data-access/identity.models';
import { TagDialog } from './tag-dialog';
import { TagsPanel } from './tags-panel';

describe('TagsPanel', () => {
  let fixture: ComponentFixture<TagsPanel>;
  let backend: HttpTestingController;
  let host: HTMLElement;

  async function render(
    tags: StudentTag[] = [aTag(), aTag({ id: 'tag-2', name: 'Класс', useInAi: false })],
  ): Promise<void> {
    TestBed.configureTestingModule({ imports: [TagsPanel], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TagsPanel);
    host = hostElement(fixture);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/tags').flush(tags);
    await fixture.whenStable();
  }

  function dialog(): TagDialog {
    const found = fixture.debugElement.query((element) => element.name === 'tb-tag-dialog');
    return found.injector.get(TagDialog);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('lists the tags with their values and the AI mark', async () => {
    await render([
      aTag({
        values: Array.from({ length: 8 }, (_, index) => ({
          id: `v${String(index)}`,
          label: `L${String(index)}`,
        })),
      }),
      aTag({ id: 'tag-2', name: 'Класс', useInAi: false }),
      aTag({ id: 'tag-3', name: 'Интересы', kind: 'TEXT', values: [] }),
    ]);

    const text = readableText(host);
    expect(text).toContain('Интересы Свободный текст');
    expect(text).toContain('Теги учеников');
    expect(text).toContain('Уровень L0 L1 L2 L3 L4 L5 ещё 2');
    expect(host.querySelectorAll('.tb-tags__ai')).toHaveLength(2);
    expect(host.querySelectorAll('li.tb-tile')).toHaveLength(3);
  });

  it('offers templates without tags and creates one at a click', async () => {
    await render([]);
    expect(readableText(host)).toContain('Тегов пока нет');

    buttonByText(host, 'Класс · 1–11').click();
    const create = backend.expectOne({ method: 'POST', url: '/api/teacher/tags' });
    expect(create.request.body).toEqual({
      name: 'Класс',
      kind: 'LIST',
      useInAi: true,
      values: Array.from({ length: 11 }, (_, index) => String(index + 1)),
    });
    create.flush(aTag({ id: 'grade', name: 'Класс' }));
    await fixture.whenStable();

    expect(host.querySelectorAll('li.tb-tile')).toHaveLength(1);
  });

  it('creates the free-text «Интересы» from its template', async () => {
    await render([]);

    buttonByText(host, 'Интересы · текст').click();
    expect(backend.expectOne({ method: 'POST', url: '/api/teacher/tags' }).request.body).toEqual({
      name: 'Интересы',
      kind: 'TEXT',
      useInAi: true,
      values: [],
    });
  });

  it('opens the dialog for a new tag and for an existing one', async () => {
    await render();
    buttonByText(host, 'Тег').click();
    await fixture.whenStable();
    expect(dialog().visible()).toBe(true);
    expect(dialog().tag()).toBeNull();

    host.querySelector<HTMLButtonElement>('li.tb-tile p-button button')?.click();
    await fixture.whenStable();
    expect(dialog().tag()?.id).toBe('tag-1');
  });

  it('takes the saved and the deleted tags into the list', async () => {
    await render();

    dialog().saved.emit({ tag: aTag({ name: 'Уровень 2' }), clearedStudents: 1 });
    dialog().saved.emit({ tag: aTag({ id: 'tag-3', name: 'Формат' }), clearedStudents: 0 });
    await fixture.whenStable();
    expect(readableText(host)).toContain('Уровень 2');
    expect(host.querySelectorAll('li.tb-tile')).toHaveLength(3);

    dialog().deleted.emit({ tag: aTag({ id: 'tag-3' }), clearedStudents: 2 });
    dialog().deleted.emit({ tag: aTag({ id: 'tag-2' }), clearedStudents: 0 });
    await fixture.whenStable();
    expect(host.querySelectorAll('li.tb-tile')).toHaveLength(1);
  });

  it('sends the new order and takes it back when it fails', async () => {
    await render();
    const handles = host.querySelectorAll('.tb-drag-handle');
    handles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    handles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    backend.expectNone('/api/teacher/tags/order');

    handles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await fixture.whenStable();
    const order = backend.expectOne({ method: 'PUT', url: '/api/teacher/tags/order' });
    expect(order.request.body).toEqual({ ids: ['tag-2', 'tag-1'] });
    order.flush('', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    const text = readableText(host);
    expect(text.indexOf('Уровень')).toBeLessThan(text.indexOf('Класс'));
  });
});
