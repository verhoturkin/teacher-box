import { TestBed } from '@angular/core/testing';
import { FocusReturn } from './focus-return';

describe('FocusReturn', () => {
  let opener: HTMLButtonElement;
  let dialog: HTMLDivElement;

  beforeEach(() => {
    opener = document.createElement('button');
    opener.textContent = 'Открыть';
    dialog = document.createElement('div');
    dialog.className = 'p-dialog-mask';
    const field = document.createElement('input');
    dialog.append(field);
    document.body.append(opener, dialog);
  });

  afterEach(() => {
    opener.remove();
    dialog.remove();
  });

  it('gives the focus back to the element that had it when a window closes', async () => {
    const service = TestBed.inject(FocusReturn);
    service.start();
    service.start();
    opener.focus();
    dialog.querySelector('input')?.focus();
    expect(document.activeElement).not.toBe(opener);

    dialog.remove();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.activeElement).toBe(opener);
  });

  it('leaves the focus where it moved on', async () => {
    const service = TestBed.inject(FocusReturn);
    service.start();
    opener.focus();
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();

    dialog.remove();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.activeElement).toBe(other);
    other.remove();
  });
});
