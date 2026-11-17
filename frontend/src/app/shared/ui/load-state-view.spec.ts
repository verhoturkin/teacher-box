import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { testProviders } from '@testing/setup';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { LoadState } from './load-state';
import { LoadStateView } from './load-state-view';

@Component({
  imports: [LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" what="задания" [compact]="true" (retry)="retries = retries + 1">
      <p class="content">Задания</p>
    </tb-load-state>
  `,
})
class Host {
  readonly state = new LoadState();
  retries = 0;
}

@Component({
  imports: [LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [skeleton]="true" [compact]="compact">
      <ul class="content"></ul>
    </tb-load-state>
  `,
})
class ListHost {
  readonly state = new LoadState();
  compact = false;
}

describe('LoadStateView', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
  });

  it('shows the loading indicator, then the content', async () => {
    const fixture = TestBed.createComponent(Host);
    const source = new Subject<number>();
    source.pipe(fixture.componentInstance.state.track()).subscribe();
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(host.querySelector('[role="status"] tb-loading-indicator')).not.toBeNull();
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    expect(host.querySelector('tb-load-state')?.classList).toContain('tb-load-state--compact');
    expect(host.querySelector('.content')).toBeNull();

    source.next(1);
    await fixture.whenStable();

    expect(host.querySelector('.content')?.textContent).toBe('Задания');
    expect(host.querySelector('tb-loading-indicator')).toBeNull();
  });

  it('leaves absolute content anchored to the caller: only the list rows position the host', async () => {
    const plain = TestBed.createComponent(Host);
    const list = TestBed.createComponent(ListHost);
    await plain.whenStable();
    await list.whenStable();
    const position = (fixture: typeof plain | typeof list): string =>
      getComputedStyle(hostElement(fixture).querySelector('tb-load-state')!).position;

    // a positioned host collapsed the board canvas (absolute, inset 0) to its own empty box
    expect(position(plain)).not.toBe('relative');
    expect(position(list)).toBe('relative');
  });

  it('shows synchronous results immediately without creating an indicator', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.state.done();
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('.content')?.textContent).toBe('Задания');
    expect(hostElement(fixture).querySelector('tb-loading-indicator')).toBeNull();
  });

  it('shows the error with «Повторить» instead of the content', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.state.fail(new Error('boom'));
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain(
      'Не удалось загрузить задания Что-то пошло не так. Попробуйте ещё раз или чуть позже Повторить',
    );
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('.content')).toBeNull();

    buttonByText(host, 'Повторить').click();

    expect(fixture.componentInstance.retries).toBe(1);
  });

  it('shows the shape of the rows of a list section instead of the indicator', async () => {
    const fixture = TestBed.createComponent(ListHost);
    const source = new Subject<number>();
    source.pipe(fixture.componentInstance.state.track()).subscribe();
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(host.querySelector('tb-load-state')?.classList).toContain('tb-load-state--skeleton');
    expect(host.querySelector('tb-loading-indicator')).toBeNull();
    const skeleton = host.querySelector('.tb-load-state__skeleton[role="status"]');
    expect(skeleton?.querySelectorAll('ul[aria-hidden="true"] > li')).toHaveLength(3);
    expect(readableText(host)).toBe('Загрузка…');

    source.next(1);
    await fixture.whenStable();

    expect(host.querySelector('.tb-load-state__content > .content')).not.toBeNull();
  });

  it('shows two rows in a compact list section', async () => {
    const fixture = TestBed.createComponent(ListHost);
    fixture.componentInstance.compact = true;
    await fixture.whenStable();

    expect(hostElement(fixture).querySelectorAll('.tb-load-state__skeleton li')).toHaveLength(2);
  });
});
