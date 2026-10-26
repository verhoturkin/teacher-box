import { TestBed } from '@angular/core/testing';
import { buttonByText, hostElement } from '@testing/dom';
import { DialogConfirmStep } from './dialog-confirm-step';

describe('DialogConfirmStep', () => {
  function create(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(DialogConfirmStep);
    fixture.componentRef.setInput('message', 'Удалить запись?');
    fixture.componentRef.setInput('confirmLabel', 'Удалить');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    return fixture;
  }

  it('asks, and answers by its two buttons', async () => {
    const fixture = create();
    const confirmed = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    await fixture.whenStable();
    const root = hostElement(fixture);

    expect(root.textContent).toContain('Удалить запись?');
    buttonByText(root, 'Отмена').click();
    expect(cancelled).toHaveBeenCalledOnce();
    buttonByText(root, 'Удалить').click();
    expect(confirmed).toHaveBeenCalledOnce();
    expect(root.querySelector('.p-button-danger')).not.toBeNull();
  });

  it('can be a primary question with its own cancel word', async () => {
    const fixture = create({ severity: 'primary', cancelLabel: 'Нет' });
    await fixture.whenStable();
    const root = hostElement(fixture);

    expect(root.querySelector('.p-button-danger')).toBeNull();
    expect(buttonByText(root, 'Нет')).toBeTruthy();
  });
});
