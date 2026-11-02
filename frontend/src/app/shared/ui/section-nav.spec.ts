import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { SectionNav, SectionNavAction, SectionNavItem, SectionNavPress } from './section-nav';

const ITEMS: SectionNavItem[] = [
  { id: 'one', icon: 'tb-i-description', label: 'Первый' },
  { id: 'two', icon: 'tb-i-quiz', label: 'Второй' },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionNav],
  template: `
    <tb-section-nav
      [items]="items"
      label="Разделы"
      [actions]="actions"
      actionsLabel="Добавить"
      (pressed)="pressed.push($event)"
    />
    <div id="one">1</div>
    <div id="two">2</div>
  `,
})
class Host {
  readonly items = ITEMS;
  readonly actions: SectionNavAction[] = [
    { id: 'video', icon: 'tb-i-smart_display', label: 'Видео' },
    { id: 'board', icon: 'tb-i-co_present', label: 'Доску', disabled: true },
  ];
  readonly pressed: SectionNavPress[] = [];
}

describe('SectionNav', () => {
  let observed: ((entries: Partial<IntersectionObserverEntry>[]) => void) | null = null;

  beforeEach(() => {
    observed = null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          observed = callback;
        }
        observe(): void {
          // the test drives the callback
        }
        disconnect(): void {
          // nothing to release
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks the first section, follows the one in view and scrolls on a click', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const current = () =>
      [...host.querySelectorAll('a')].map((link) => link.getAttribute('aria-current'));
    expect(current()).toEqual(['location', null]);

    const first = host.querySelector<HTMLElement>('#one');
    const second = host.querySelector<HTMLElement>('#two');
    if (first === null || second === null) {
      throw new Error('sections not rendered');
    }
    observed?.([{ isIntersecting: true, target: second }]);
    await fixture.whenStable();
    expect(current()).toEqual([null, 'location']);

    observed?.([{ isIntersecting: false, target: second }]);
    const scroll = vi.fn();
    first.scrollIntoView = scroll;
    host.querySelector('a')?.click();
    await fixture.whenStable();
    expect(scroll).toHaveBeenCalledOnce();
    expect(current()).toEqual(['location', null]);
  });

  it('lists the actions under their heading and reports a press', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.tb-section-nav__action')];
    const list = host.querySelectorAll('ul')[1];
    const heading = host.querySelector('.tb-section-nav__subhead');
    expect(heading?.textContent.trim()).toBe('Добавить');
    expect(list?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(buttons.map((button) => [button.textContent.trim(), button.disabled])).toEqual([
      ['Видео', false],
      ['Доску', true],
    ]);

    buttons[0]?.click();
    expect(fixture.componentInstance.pressed.map((press) => press.id)).toEqual(['video']);
  });
});
