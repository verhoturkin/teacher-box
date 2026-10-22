import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { screenWidth } from '@testing/setup';
import { MediumPanes, Pane, Panes, PaneHeader, PaneKind, injectListDetail } from './panes';

@Component({
  selector: 'tb-embedded-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PaneHeader],
  template: `<ng-template tbPaneHeader
      ><button type="button" (click)="count.set(count() + 1)">
        Heading {{ count() }}
      </button></ng-template
    >
    <p>Body</p>`,
})
class EmbeddedHeading {
  readonly count = signal(0);
}
@Component({
  imports: [Pane, Panes, EmbeddedHeading],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-panes
    ><tb-pane>
      @if (show()) {
        <tb-embedded-heading />
      }</tb-pane
  ></tb-panes>`,
})
class EmbeddedHost {
  readonly show = signal(true);
}

@Component({
  selector: 'tb-panes-host',
  imports: [Panes, Pane],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes [medium]="medium()">
      <tb-pane [kind]="first()" label="Список">
        <h2 tbPaneHeader>Заголовок</h2>
        <button type="button">Первая</button>
      </tb-pane>
      <tb-pane><button type="button">Вторая</button></tb-pane>
      @if (sheet()) {
        <tb-pane kind="sheet"><button type="button">Третья</button></tb-pane>
      }
    </tb-panes>
  `,
})
class PanesHost {
  readonly first = signal<PaneKind>('fixed');
  readonly sheet = signal(true);
  readonly medium = signal<MediumPanes>('one');
}

@Component({
  selector: 'tb-list-detail-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ListDetailHost {
  readonly open = signal(false);
  readonly layout = injectListDetail(() => this.open());
}

@Component({
  selector: 'tb-two-on-medium-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class TwoOnMediumHost {
  readonly open = signal(false);
  readonly layout = injectListDetail(() => this.open(), 'two');
}

describe('Panes', () => {
  async function render(width: number, medium: MediumPanes = 'one') {
    TestBed.configureTestingModule({ providers: [screenWidth(width)] });
    const fixture = TestBed.createComponent(PanesHost);
    fixture.componentInstance.medium.set(medium);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const panes = Array.from(host.querySelectorAll<HTMLElement>('tb-pane'));
    return { fixture, host, panes };
  }

  it('keeps an embedded heading outside the scroll area and removes it with its component', async () => {
    const fixture = TestBed.createComponent(EmbeddedHost);
    await fixture.whenStable();
    const host = hostElement(fixture);
    const button = requireElement(host, '.tb-pane__header button', HTMLButtonElement);
    expect(host.querySelector('.tb-pane__scroll button')).toBeNull();
    expect(host.querySelector('.tb-pane__scroll p')?.textContent).toBe('Body');
    button.click();
    await fixture.whenStable();
    expect(readableText(button)).toBe('Heading 1');
    fixture.componentInstance.show.set(false);
    await fixture.whenStable();
    expect(host.querySelector('.tb-pane__header button')).toBeNull();
  });

  it.each([
    [839, ''],
    [840, '22.5rem'],
    [1199, '22.5rem'],
    [1200, '25.75rem'],
    [1599, '25.75rem'],
    [1600, '25.75rem'],
  ])('gives a fixed pane its M3 width at %i px', async (width, basis) => {
    const { panes } = await render(width);

    expect(panes[0]?.style.flexBasis).toBe(basis);
  });

  it('stands the panes side by side from expanded: the flexible takes the rest, the sheet ≤ 400 dp', async () => {
    const { host, panes } = await render(1600);

    expect(requireElement(host, 'tb-panes', HTMLElement).classList).not.toContain(
      'tb-panes--single',
    );
    const [, flexible, sheet] = panes;
    expect(flexible?.style.flexGrow).toBe('1');
    expect(flexible?.style.flexBasis).toBe('0%');
    expect(sheet?.classList).toContain('tb-pane--sheet');
    expect(sheet?.style.flexBasis).toBe('25rem');
    expect(sheet?.style.maxWidth).toBe('25rem');
  });

  it.each([599, 600, 839])('puts the panes one under another at %i px', async (width) => {
    const { host, panes } = await render(width);

    expect(requireElement(host, 'tb-panes', HTMLElement).classList).toContain('tb-panes--single');
    for (const pane of panes) {
      expect(pane.style.flexBasis).toBe('');
      expect(pane.style.flexGrow).toBe('');
      expect(pane.style.maxWidth).toBe('');
    }
  });

  it.each([600, 839])(
    'gives every pane an equal share at %i px with two panes on medium',
    async (width) => {
      const { host, panes } = await render(width, 'two');

      expect(requireElement(host, 'tb-panes', HTMLElement).classList).not.toContain(
        'tb-panes--single',
      );
      for (const pane of panes) {
        expect(pane.style.flexBasis).toBe('0%');
        expect(pane.style.flexGrow).toBe('1');
      }
    },
  );

  it.each([
    [599, ''],
    [840, '22.5rem'],
  ])('keeps the other breakpoints with two panes on medium at %i px', async (width, basis) => {
    const { panes } = await render(width, 'two');

    expect(panes[0]?.style.flexBasis).toBe(basis);
  });

  it('keeps the focus order of the visual order: the template order, no reordering', async () => {
    const { host, panes } = await render(1600);

    expect(Array.from(host.querySelectorAll('button')).map((button) => button.textContent)).toEqual(
      ['Первая', 'Вторая', 'Третья'],
    );
    for (const pane of panes) {
      expect(pane.style.order).toBe('');
      expect(pane.getAttribute('tabindex')).toBeNull();
    }
  });

  it('names a pane with a label as a region', async () => {
    const { panes } = await render(1200);

    expect(panes[0]?.getAttribute('role')).toBe('region');
    expect(panes[0]?.getAttribute('aria-label')).toBe('Список');
    expect(panes[1]?.hasAttribute('role')).toBe(false);
    expect(panes[1]?.hasAttribute('aria-label')).toBe(false);
  });

  it('keeps a persistent heading outside the scrolling content', async () => {
    const { panes } = await render(1200);
    const pane = panes[0]!;
    expect(pane.querySelector('.tb-pane__header h2')?.textContent).toBe('Заголовок');
    expect(pane.querySelector('.tb-pane__scroll h2')).toBeNull();
    expect(pane.querySelector('.tb-pane__scroll button')?.textContent).toBe('Первая');
  });

  it('shows the panes of a new page without motion and adds and removes a pane', async () => {
    const { fixture, host, panes } = await render(1600);
    expect(panes.some((pane) => pane.classList.contains('tb-pane--enter'))).toBe(false);

    fixture.componentInstance.sheet.set(false);
    await fixture.whenStable();
    expect(host.querySelectorAll('tb-pane')).toHaveLength(2);

    fixture.componentInstance.sheet.set(true);
    await fixture.whenStable();
    expect(host.querySelectorAll('tb-pane')).toHaveLength(3);
  });

  it('changes the kind of a pane', async () => {
    const { fixture, panes } = await render(1200);

    fixture.componentInstance.first.set('flexible');
    await fixture.whenStable();

    expect(panes[0]?.style.flexGrow).toBe('1');
  });
});

describe('injectListDetail', () => {
  function create(width: number) {
    TestBed.configureTestingModule({ providers: [screenWidth(width)] });
    return TestBed.createComponent(ListDetailHost).componentInstance;
  }

  it.each([599, 839])('shows the list or the detail by the route at %i px', (width) => {
    const host = create(width);
    expect(host.layout.single()).toBe(true);
    expect([host.layout.list(), host.layout.detail()]).toEqual([true, false]);

    host.open.set(true);

    expect([host.layout.list(), host.layout.detail()]).toEqual([false, true]);
  });

  it.each([840, 1200, 1600])('shows both from expanded at %i px', (width) => {
    const host = create(width);
    expect(host.layout.single()).toBe(false);
    expect([host.layout.list(), host.layout.detail()]).toEqual([true, true]);

    host.open.set(true);

    expect([host.layout.list(), host.layout.detail()]).toEqual([true, true]);
  });

  it('shows the list or the detail at 599 px and both at 600 and 839 px with two panes on medium', () => {
    TestBed.configureTestingModule({ providers: [screenWidth(599)] });
    const compact = TestBed.createComponent(TwoOnMediumHost).componentInstance;
    expect([compact.layout.single(), compact.layout.list(), compact.layout.detail()]).toEqual([
      true,
      true,
      false,
    ]);
    compact.open.set(true);
    expect([compact.layout.list(), compact.layout.detail()]).toEqual([false, true]);
  });

  it.each([600, 839])('shows both at %i px with two panes on medium', (width) => {
    TestBed.configureTestingModule({ providers: [screenWidth(width)] });
    const host = TestBed.createComponent(TwoOnMediumHost).componentInstance;

    expect([host.layout.single(), host.layout.list(), host.layout.detail()]).toEqual([
      false,
      true,
      true,
    ]);
  });
});
