import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageDetail, pageDetail } from './page-detail';

@Component({
  selector: 'tb-detail-host',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly name = signal<string | null>(null);

  constructor() {
    pageDetail(() => this.name());
  }
}

describe('pageDetail', () => {
  it('shows the detail of the page while it lives and removes it with the page', async () => {
    const fixture = TestBed.createComponent(Host);
    const store = TestBed.inject(PageDetail).value;
    await fixture.whenStable();
    expect(store()).toBeNull();

    fixture.componentInstance.name.set('Алиса Соловьёва');
    await fixture.whenStable();
    expect(store()).toBe('Алиса Соловьёва');

    fixture.destroy();
    expect(store()).toBeNull();
  });
});
