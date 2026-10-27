import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UnsavedChanges, guardUnsaved } from './unsaved-changes';

const changed = signal(false);

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Card {
  constructor() {
    guardUnsaved(() => changed());
  }
}

describe('guardUnsaved', () => {
  function reload(): boolean {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  beforeEach(() => {
    changed.set(false);
  });

  it('reports the changes of a living card and forgets the card when it is gone', () => {
    const unsaved = TestBed.inject(UnsavedChanges);
    expect(unsaved.dirty()).toBe(false);
    const card = TestBed.createComponent(Card);

    expect(unsaved.dirty()).toBe(false);
    expect(reload()).toBe(false);

    changed.set(true);
    expect(unsaved.dirty()).toBe(true);
    expect(reload()).toBe(true);

    card.destroy();
    expect(unsaved.dirty()).toBe(false);
    expect(reload()).toBe(false);
  });
});
