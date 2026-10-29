import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { InputChip } from './input-chip';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputChip],
  template: `
    <tb-input-chip
      label="Группа B1 · 4"
      removeLabel="Убрать: Группа B1"
      (removed)="removed.set(true)"
    >
      <i lead class="tb-i tb-i-groups"></i>
    </tb-input-chip>
  `,
})
class Host {
  readonly removed = signal(false);
}

describe('InputChip', () => {
  it('shows the label with its lead and emits `removed` from the named «×»', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(host.textContent).toContain('Группа B1 · 4');
    expect(host.querySelector('.tb-i-groups')).not.toBeNull();

    host.querySelector<HTMLButtonElement>('button[aria-label="Убрать: Группа B1"]')?.click();
    expect(fixture.componentInstance.removed()).toBe(true);
  });
});
