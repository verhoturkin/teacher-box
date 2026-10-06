import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { aParticipant } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallSelf } from './call-self';

describe('CallSelf', () => {
  let fixture: ComponentFixture<CallSelf>;
  let host: HTMLElement;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({ imports: [CallSelf], providers: testProviders() });
    fixture = TestBed.createComponent(CallSelf);
    fixture.componentRef.setInput('participant', aParticipant({ name: 'Мария' }));
    await fixture.whenStable();
    host = hostElement(fixture);
    host.setPointerCapture = () => undefined;
  }

  beforeEach(() => {
    localStorage.removeItem('tb-call-self-corner');
  });

  afterEach(() => {
    fixture.destroy();
  });

  function pointer(type: string, x: number, y: number): void {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    host.dispatchEvent(event);
  }

  function key(name: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    host.dispatchEvent(event);
    return event;
  }

  it('shows the own tile in the bottom right corner', async () => {
    await render();

    expect(host.textContent).toContain('Мария (вы)');
    expect(host.classList).toContain('tb-call-self--bottom-right');
    expect(host.tabIndex).toBe(0);
  });

  it('is dragged anywhere and snaps to the nearest corner, remembered', async () => {
    await render();
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 60));

    pointer('pointerdown', 900, 700);
    pointer('pointermove', 100, 100);
    await fixture.whenStable();
    expect(host.style.translate).toBe('-800px -600px');
    expect(host.classList).toContain('tb-call-self--dragging');
    pointer('pointerup', 100, 100);
    await fixture.whenStable();

    expect(host.classList).toContain('tb-call-self--top-left');
    expect(host.style.translate).toBe('');
    expect(localStorage.getItem('tb-call-self-corner')).toBe('top-left');

    fixture.destroy();
    TestBed.resetTestingModule();
    await render();
    expect(host.classList).toContain('tb-call-self--top-left');
  });

  it('moves with the arrow keys and ignores other keys', async () => {
    await render();

    expect(key('ArrowUp').defaultPrevented).toBe(true);
    await fixture.whenStable();
    expect(host.classList).toContain('tb-call-self--top-right');
    key('ArrowLeft');
    await fixture.whenStable();
    expect(host.classList).toContain('tb-call-self--top-left');
    key('ArrowDown');
    key('ArrowRight');
    await fixture.whenStable();
    expect(host.classList).toContain('tb-call-self--bottom-right');
    expect(key('Enter').defaultPrevented).toBe(false);
  });

  it('measures the corner within its positioning parent', async () => {
    await render();
    const parent = document.createElement('div');
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 400, 300));
    vi.spyOn(host, 'offsetParent', 'get').mockReturnValue(parent);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(380, 120, 100, 60));

    pointer('pointerdown', 0, 0);
    pointer('pointerup', 0, 0);
    await fixture.whenStable();

    expect(host.classList).toContain('tb-call-self--top-right');
  });
});
