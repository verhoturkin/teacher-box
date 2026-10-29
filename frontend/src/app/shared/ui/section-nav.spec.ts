import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { SectionNav, SectionNavItem } from './section-nav';

const ITEMS: SectionNavItem[] = [
  { id: 'one', icon: 'description', label: 'Первый' },
  { id: 'two', icon: 'quiz', label: 'Второй' },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionNav],
  template: `
    <tb-section-nav [items]="items" label="Разделы" />
    <div id="one">1</div>
    <div id="two">2</div>
  `,
})
class Host {
  readonly items = ITEMS;
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
});
