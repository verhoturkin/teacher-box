import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { hostElement, requireElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { TabIndicator } from './tab-indicator';

@Component({
  imports: [Tabs, TabIndicator, TabList, Tab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-tabs tbTabIndicator class="tb-tabs" value="b">
      <p-tablist>
        <p-tab value="a"><span class="tb-tab-label" data-x="16" data-w="40">A</span></p-tab>
        <p-tab value="b"><span class="tb-tab-label" data-x="100" data-w="60">B</span></p-tab>
        <p-tab value="c"><span class="tb-tab-label" data-x="200" data-w="80">C</span></p-tab>
      </p-tablist>
    </p-tabs>
  `,
})
class Host {}

/** The resize observers that watch something (PrimeNG's and ours), resized by hand: jsdom lays nothing out. */
const watching = new Set<() => void>();
const resize = () => {
  watching.forEach((callback) => {
    callback();
  });
};

class ManualResizeObserver {
  constructor(private readonly callback: () => void) {}

  observe(): void {
    watching.add(this.callback);
  }

  unobserve(): void {
    watching.delete(this.callback);
  }

  disconnect(): void {
    watching.delete(this.callback);
  }
}

describe('TabIndicator', () => {
  const staticObserver = window.ResizeObserver;

  beforeEach(() => {
    // test-setup defines it writable, not configurable
    Reflect.set(window, 'ResizeObserver', ManualResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (frame: () => void) => {
      frame();
      return 0;
    });
    // the list starts 10 px from the viewport, 300 px wide; each label says where it is
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const x = this.dataset['x'];
      return x === undefined
        ? new DOMRect(10, 0, 300, 48)
        : new DOMRect(10 + Number(x), 0, Number(this.dataset['w']), 48);
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    TestBed.configureTestingModule({ providers: testProviders() });
  });

  afterEach(() => {
    Reflect.set(window, 'ResizeObserver', staticObserver);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const list = requireElement(hostElement(fixture), '.p-tablist-tab-list', HTMLElement);
    const edges = () => [
      list.style.getPropertyValue('--tb-tab-start'),
      list.style.getPropertyValue('--tb-tab-end'),
      list.dataset['tbTabMove'],
    ];
    return { fixture, list, edges };
  }

  async function choose(fixture: Awaited<ReturnType<typeof render>>['fixture'], text: string) {
    const tab = [...hostElement(fixture).querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (element) => element.textContent.trim() === text,
    );
    tab?.click();
    await fixture.whenStable();
    // the mutation observer delivers after the render
    await Promise.resolve();
  }

  it('first stands under the label of the active tab without moving', async () => {
    const { edges } = await render();

    expect(edges()).toEqual(['100px', '140px', 'none']);
  });

  it('slides right, then left, to the label of the chosen tab', async () => {
    const { fixture, edges } = await render();

    await choose(fixture, 'C');
    expect(edges()).toEqual(['200px', '20px', 'right']);

    await choose(fixture, 'A');
    expect(edges()).toEqual(['16px', '244px', 'left']);
  });

  it('jumps when the bar is resized after the slide', async () => {
    const { fixture, list, edges } = await render();
    await choose(fixture, 'C');
    requireElement(list, '.p-tab-active .tb-tab-label', HTMLElement).dataset['w'] = '90';
    const now = performance.now();
    vi.spyOn(performance, 'now').mockReturnValue(now + 1_000);

    resize();

    expect(edges()).toEqual(['200px', '10px', 'none']);
  });

  it('keeps sliding when the labels resize during the slide', async () => {
    const { fixture, list, edges } = await render();
    await choose(fixture, 'C');
    requireElement(list, '.p-tab-active .tb-tab-label', HTMLElement).dataset['w'] = '90';

    resize();

    expect(edges()).toEqual(['200px', '10px', 'right']);
  });

  it('stays where it is without an active tab or a change', async () => {
    const { fixture, edges } = await render();

    resize();
    expect(edges()).toEqual(['100px', '140px', 'none']);

    requireElement(hostElement(fixture), '.p-tab-active', HTMLElement).classList.remove(
      'p-tab-active',
    );
    await Promise.resolve();
    expect(edges()).toEqual(['100px', '140px', 'none']);
  });

  it('stops watching the bar when it goes', async () => {
    const { fixture } = await render();

    fixture.destroy();

    expect(watching.size).toBe(0);
  });
});
