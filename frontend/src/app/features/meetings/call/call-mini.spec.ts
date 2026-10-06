import { BreakpointObserver } from '@angular/cdk/layout';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { buttonByText, hostElement } from '@testing/dom';
import { aMediaRef, aParticipant } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallMini } from './call-mini';
import { CallSession } from './call-session';

describe('CallMini', () => {
  let fixture: ComponentFixture<CallMini>;
  let session: CallSession;
  let host: HTMLElement;

  async function render(mobile = false): Promise<void> {
    TestBed.configureTestingModule({
      imports: [CallMini],
      providers: testProviders({
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: mobile, breakpoints: {} }) },
      }),
    });
    session = TestBed.inject(CallSession);
    session.target.set({ ownerId: 'g-1', title: 'ОГЭ' });
    session.phase.set('connected');
    session.participants.set([
      aParticipant(),
      aParticipant({ id: 'a', name: 'Анна', local: false, camera: aMediaRef() }),
    ]);
    fixture = TestBed.createComponent(CallMini);
    fixture.componentRef.setInput('elapsed', '0:42');
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  beforeEach(() => {
    localStorage.removeItem('tb-call-corner');
  });

  afterEach(() => {
    fixture.destroy();
  });

  function pointer(type: string, x: number, y: number, target: Element): void {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    target.dispatchEvent(event);
  }

  it('shows the room, the time and whoever matters now', async () => {
    await render();

    expect(host.textContent).toContain('ОГЭ');
    expect(host.textContent).toContain('0:42');
    expect(host.querySelector('tb-call-tile')?.textContent).toContain('Анна');
    expect(host.classList).toContain('tb-call-mini--bottom-right');

    session.phase.set('reconnecting');
    await fixture.whenStable();
    expect(host.textContent).toContain('Переподключение…');
  });

  it('moves to the next corner and remembers it', async () => {
    await render();

    buttonByText(host, 'Переместить окно звонка').click();
    await fixture.whenStable();

    expect(host.classList).toContain('tb-call-mini--bottom-left');
    expect(localStorage.getItem('tb-call-corner')).toBe('bottom-left');
    fixture.destroy();
    TestBed.resetTestingModule();
    await render();
    expect(host.classList).toContain('tb-call-mini--bottom-left');
  });

  it('is dragged by its top line and snaps to the nearest corner', async () => {
    await render();
    const head = host.querySelector('.tb-call-mini__head');
    if (head === null) {
      throw new Error('no head');
    }
    head.setPointerCapture = () => undefined;

    pointer('pointerdown', 100, 100, head);
    pointer('pointermove', 60, 40, head);
    await fixture.whenStable();
    expect(host.style.translate).toBe('-40px -60px');
    expect(host.classList).toContain('tb-call-mini--dragging');
    pointer('pointerup', 60, 40, head);
    await fixture.whenStable();

    expect(host.classList).toContain('tb-call-mini--top-left');
    expect(host.style.translate).toBe('');

    pointer('pointerdown', 10, 10, head);
    pointer('pointercancel', 10, 10, head);
    pointer('pointermove', 20, 20, head);
    pointer('pointerup', 20, 20, head);
    const button = head.querySelector('button');
    if (button !== null) {
      pointer('pointerdown', 10, 10, button);
    }
    await fixture.whenStable();
    expect(host.classList).not.toContain('tb-call-mini--dragging');
  });

  it('is a bar without the video on a phone', async () => {
    await render(true);
    const head = host.querySelector('.tb-call-mini__head');

    expect(host.classList).toContain('tb-call-mini--bar');
    expect(host.querySelector('tb-call-tile')).toBeNull();
    expect(host.querySelector('button[aria-label="Переместить окно звонка"]')).toBeNull();
    if (head !== null) {
      pointer('pointerdown', 10, 10, head);
    }
    await fixture.whenStable();
    expect(host.classList).not.toContain('tb-call-mini--dragging');
  });

  it('keeps working without storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('off');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('off');
    });
    await render();

    buttonByText(host, 'Переместить окно звонка').click();
    await fixture.whenStable();
    expect(host.classList).toContain('tb-call-mini--bottom-left');
    vi.restoreAllMocks();
  });
});
