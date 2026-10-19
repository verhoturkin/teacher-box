import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { NEW_MESSAGE_DIALOG, NewMessage, NewMessageState } from './new-message';

@Component({
  selector: 'tb-test-new-message-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: 'Сообщение ученикам',
})
class TestDialog {}

describe('NewMessageState', () => {
  it('opens, closes and counts the messages sent', () => {
    const state = TestBed.inject(NewMessageState);
    expect(state.open()).toBe(false);

    state.show();
    expect(state.open()).toBe(true);
    state.markSent();
    state.markSent();
    state.close();

    expect(state.open()).toBe(false);
    expect(state.sent()).toBe(2);
  });
});

describe('NewMessage', () => {
  let fixture: ComponentFixture<NewMessage>;

  async function render(dialog: boolean): Promise<void> {
    const load = vi.fn(() => Promise.resolve(TestDialog));
    TestBed.configureTestingModule({
      imports: [NewMessage],
      providers: dialog ? [{ provide: NEW_MESSAGE_DIALOG, useValue: load }] : [],
    });
    fixture = TestBed.createComponent(NewMessage);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('loads the dialog of the feature when first asked for, once', async () => {
    await render(true);
    const load = TestBed.inject(NEW_MESSAGE_DIALOG);
    expect(load).not.toHaveBeenCalled();
    expect(hostElement(fixture).textContent).toBe('');

    const state = TestBed.inject(NewMessageState);
    state.show();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(hostElement(fixture).textContent).toContain('Сообщение ученикам');
    });

    state.close();
    await fixture.whenStable();
    state.show();
    await fixture.whenStable();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows nothing without the feature', async () => {
    await render(false);

    TestBed.inject(NewMessageState).show();
    await fixture.whenStable();

    expect(hostElement(fixture).textContent).toBe('');
  });
});
