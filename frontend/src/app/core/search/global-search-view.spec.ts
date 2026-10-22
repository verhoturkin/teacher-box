import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { hostElement, requireElement, typeInto } from '@testing/dom';
import { testProvidersWithRouter } from '@testing/setup';
import { GlobalSearchView } from './global-search-view';
import { GlobalSearch, SEARCH_SOURCES, SearchEntry, SearchGroup, SearchSource } from './search';

function entry(group: SearchGroup, id: string, title: string, subtitle?: string): SearchEntry {
  return { id, group, title, subtitle, link: ['/teacher', group, id] };
}

const ENTRIES: readonly SearchEntry[] = [
  entry('students', 's1', 'Анна Иванова', 'anna@example.com'),
  entry('students', 's2', 'Антон Петров'),
  entry('groups', 'g1', 'Группа Анны'),
  entry('boards', 'b1', 'Доска Анны'),
];

describe('GlobalSearchView', () => {
  let fixture: ComponentFixture<GlobalSearchView>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function render(
    full = false,
    load: (group: SearchGroup) => Observable<readonly SearchEntry[]> = (group) =>
      of(ENTRIES.filter((e) => e.group === group)),
  ): Promise<HTMLElement> {
    const sources: SearchSource[] = (['students', 'groups', 'boards'] as const).map((group) => ({
      group,
      load: () => load(group),
    }));
    TestBed.configureTestingModule({
      imports: [GlobalSearchView],
      providers: testProvidersWithRouter(provideRouter([{ path: '**', children: [] }]), {
        provide: SEARCH_SOURCES,
        useValue: () => Promise.resolve(sources),
      }),
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(GlobalSearchView);
    fixture.componentRef.setInput('full', full);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  const input = (host: HTMLElement): HTMLInputElement =>
    requireElement(host, 'input[role="combobox"]', HTMLInputElement);

  async function type(host: HTMLElement, value: string): Promise<void> {
    input(host).focus();
    typeInto(input(host), value);
    await fixture.whenStable();
  }

  function press(host: HTMLElement, key: string): void {
    input(host).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  }

  const titles = (host: HTMLElement): string[] =>
    Array.from(host.querySelectorAll('[role="option"] .tb-search__option-title')).map((el) =>
      el.textContent.trim(),
    );

  beforeEach(() => {
    // jsdom does not scroll
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('is a combobox with the placeholder and the shortcut hint, and its results are closed', async () => {
    const host = await render();

    expect(input(host).placeholder).toBe('Ученики, задания, доски');
    expect(input(host).getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.tb-search__shortcut')?.textContent).toMatch(/Ctrl K|⌘ K/);
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });

  it('shows the hint when the field is focused and empty', async () => {
    const host = await render();
    input(host).focus();
    await fixture.whenStable();

    expect(input(host).getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Начните вводить');
  });

  it('groups the results in a listbox and marks the first one active', async () => {
    const host = await render();
    await type(host, 'анн');

    expect(titles(host)).toEqual(['Анна Иванова', 'Группа Анны', 'Доска Анны']);
    expect(
      Array.from(host.querySelectorAll('.tb-search__group')).map((g) => g.textContent.trim()),
    ).toEqual(['Ученики', 'Группы', 'Доски']);
    const first = requireElement(host, '[role="option"]', HTMLElement);
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(input(host).getAttribute('aria-activedescendant')).toBe(first.id);
    expect(host.querySelector('[role="listbox"]')?.id).toBe(
      input(host).getAttribute('aria-controls'),
    );
  });

  it('moves the active result with ↓ and ↑ (round) and opens it with Enter', async () => {
    const host = await render();
    await type(host, 'анн');

    press(host, 'ArrowDown');
    await fixture.whenStable();
    expect(host.querySelectorAll('[role="option"]')[1]?.getAttribute('aria-selected')).toBe('true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    press(host, 'ArrowUp');
    press(host, 'ArrowUp');
    await fixture.whenStable();
    expect(host.querySelectorAll('[role="option"]')[2]?.getAttribute('aria-selected')).toBe('true');

    press(host, 'Enter');
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/teacher', 'boards', 'b1'], {
      queryParams: undefined,
    });
    expect(input(host).value).toBe('');
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });

  it('closes the results with Esc, then clears the field with the next Esc', async () => {
    const host = await render();
    await type(host, 'анн');

    press(host, 'Escape');
    await fixture.whenStable();
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(input(host).value).toBe('анн');

    press(host, 'Escape');
    await fixture.whenStable();
    expect(TestBed.inject(GlobalSearch).query()).toBe('');
  });

  it('reopens the results with ↓ after Esc and does nothing on Enter without a result', async () => {
    const host = await render();
    await type(host, 'zzz');
    press(host, 'Enter');
    expect(navigate).not.toHaveBeenCalled();
    press(host, 'Escape');
    press(host, 'ArrowDown');
    await fixture.whenStable();

    expect(host.querySelector('[role="status"]')?.textContent).toContain('Ничего не найдено');
  });

  it('says that nothing was found', async () => {
    const host = await render();
    await type(host, 'zzz');

    expect(host.querySelector('[role="status"]')?.textContent.trim()).toBe(
      'Ничего не найдено по запросу «zzz»',
    );
  });

  it('shows «Ещё N» for the entries beyond the limit', async () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      entry('students', `s${String(i)}`, `Ученик ${String(i)}`),
    );
    const host = await render(false, (group) => of(group === 'students' ? many : []));
    await type(host, 'ученик');

    expect(titles(host)).toHaveLength(5);
    expect(host.querySelector('.tb-search__more')?.textContent.trim()).toBe('Ещё 2');
  });

  it('names a group that could not be loaded and still answers from the others', async () => {
    const host = await render(false, (group) =>
      group === 'groups'
        ? throwError(() => new Error('x'))
        : of(ENTRIES.filter((e) => e.group === group)),
    );
    await type(host, 'анн');

    expect(titles(host)).toEqual(['Анна Иванова', 'Доска Анны']);
    expect(host.textContent).toContain('Не удалось загрузить: Группы');
  });

  it('clears the field with «Очистить поиск» and keeps the focus in it', async () => {
    const host = await render();
    await type(host, 'анн');

    requireElement(host, 'button[aria-label="Очистить поиск"]', HTMLButtonElement).click();
    await fixture.whenStable();

    expect(input(host).value).toBe('');
    expect(document.activeElement).toBe(input(host));
  });

  it('closes the results when the focus leaves the bar, not when it moves inside', async () => {
    const host = await render();
    await type(host, 'анн');
    const inside = requireElement(host, '[role="option"]', HTMLElement);
    input(host).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: inside }));
    await fixture.whenStable();
    expect(host.querySelector('[role="listbox"]')).not.toBeNull();

    input(host).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await fixture.whenStable();
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });

  it('focuses the field on demand (Ctrl K)', async () => {
    const host = await render();
    fixture.componentInstance.focus();

    expect(document.activeElement).toBe(input(host));
  });

  describe('full screen (compact)', () => {
    it('renders nothing while closed', async () => {
      const host = await render(true);

      expect(host.querySelector('.tb-search')).toBeNull();
    });

    it('opens as a dialog with the focus in the field and returns the focus on closing', async () => {
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();
      const host = await render(true);
      fixture.componentInstance.open.set(true);
      await fixture.whenStable();

      expect(host.querySelector('.tb-search')?.getAttribute('role')).toBe('dialog');
      expect(host.querySelector('.tb-search')?.getAttribute('aria-modal')).toBe('true');
      expect(document.activeElement).toBe(input(host));
      await fixture.whenStable();
      expect(host.querySelector('[role="status"]')?.textContent).toContain('Начните вводить');

      press(host, 'Escape');
      await fixture.whenStable();

      expect(fixture.componentInstance.open()).toBe(false);
      expect(host.querySelector('.tb-search')).toBeNull();
      expect(document.activeElement).toBe(opener);
      opener.remove();
    });

    it('closes with «назад» and after a result is opened', async () => {
      const host = await render(true);
      fixture.componentInstance.open.set(true);
      await fixture.whenStable();
      requireElement(host, 'button[aria-label="Закрыть поиск"]', HTMLButtonElement).click();
      await fixture.whenStable();
      expect(fixture.componentInstance.open()).toBe(false);

      fixture.componentInstance.open.set(true);
      await fixture.whenStable();
      await type(host, 'анн');
      requireElement(host, '[role="option"]', HTMLElement).click();
      await fixture.whenStable();
      expect(fixture.componentInstance.open()).toBe(false);
    });

    it('keeps Tab inside the dialog', async () => {
      const host = await render(true);
      fixture.componentInstance.open.set(true);
      await fixture.whenStable();
      await type(host, 'анн');
      const back = requireElement(host, 'button[aria-label="Закрыть поиск"]', HTMLButtonElement);
      const clear = requireElement(host, 'button[aria-label="Очистить поиск"]', HTMLButtonElement);

      clear.focus();
      const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      clear.dispatchEvent(forward);
      expect(forward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(back);

      const backward = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      back.dispatchEvent(backward);
      expect(backward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(clear);

      input(host).focus();
      const middle = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      input(host).dispatchEvent(middle);
      expect(middle.defaultPrevented).toBe(false);
    });
  });
});
