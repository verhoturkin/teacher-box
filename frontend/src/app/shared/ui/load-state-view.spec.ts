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

    expect(host.querySelector('[role="status"] p-progressspinner')).not.toBeNull();
    expect(host.querySelector('tb-load-state')?.classList).toContain('tb-load-state--compact');
    expect(host.querySelector('.content')).toBeNull();

    source.next(1);
    await fixture.whenStable();

    expect(host.querySelector('.content')?.textContent).toBe('Задания');
    expect(host.querySelector('p-progressspinner')).toBeNull();
  });

  it('shows the error with «Повторить» instead of the content', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.state.fail(new Error('boom'));
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain(
      'Не удалось загрузить задания Произошла ошибка. Попробуйте позже Повторить',
    );
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('.content')).toBeNull();

    buttonByText(host, 'Повторить').click();

    expect(fixture.componentInstance.retries).toBe(1);
  });
});
