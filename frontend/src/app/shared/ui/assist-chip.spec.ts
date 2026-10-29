import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { AssistChip } from './assist-chip';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AssistChip],
  template: `
    <tb-assist-chip icon="attach_file" (click)="clicks = clicks + 1">Файл</tb-assist-chip>
    <tb-assist-chip [dashed]="true" [disabled]="true">Ещё</tb-assist-chip>
  `,
})
class Host {
  clicks = 0;
}

describe('AssistChip', () => {
  it('is a button with a leading icon; dashed marks an add-chip, disabled stops it', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const buttons = hostElement(fixture).querySelectorAll<HTMLButtonElement>('button');
    const file = buttons.item(0);
    const more = buttons.item(1);

    expect(file.querySelector('.tb-i-attach_file')).not.toBeNull();
    expect(file.classList).not.toContain('tb-assist-chip--dashed');
    expect(more.querySelector('.tb-i')).toBeNull();
    expect(more.classList).toContain('tb-assist-chip--dashed');
    expect(more.disabled).toBe(true);

    file.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
