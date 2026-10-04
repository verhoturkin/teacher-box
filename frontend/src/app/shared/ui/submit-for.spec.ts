import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from 'primeng/button';
import { hostElement, requireElement } from '@testing/dom';
import { SubmitFor } from './submit-for';

@Component({
  imports: [Button, SubmitFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form id="first" (submit)="submitted.push('first'); $event.preventDefault()">
      <input id="name" />
    </form>
    <form id="second" (submit)="submitted.push('second'); $event.preventDefault()"></form>
    <p-button type="submit" label="Сохранить" [tbSubmitFor]="target()" />
  `,
})
class Host {
  readonly submitted: string[] = [];
  readonly target = signal('first');
}

describe('SubmitFor', () => {
  it('ties the submit button outside the form to the form', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = requireElement(hostElement(fixture), 'p-button button', HTMLButtonElement);

    expect(button.getAttribute('form')).toBe('first');
    expect(button.form?.id).toBe('first');
    button.click();
    expect(fixture.componentInstance.submitted).toEqual(['first']);

    fixture.componentInstance.target.set('second');
    await fixture.whenStable();
    expect(button.getAttribute('form')).toBe('second');
    button.click();
    expect(fixture.componentInstance.submitted).toEqual(['first', 'second']);
  });
});
