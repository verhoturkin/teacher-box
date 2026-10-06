import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, menuItemByText } from '@testing/dom';
import { aMediaRef, aParticipant } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallControls } from './call-controls';
import { CallDevices } from './call-devices';
import { CallSession } from './call-session';

function device(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: 'g', toJSON: () => ({}) };
}

describe('CallControls', () => {
  let fixture: ComponentFixture<CallControls>;
  let session: CallSession;
  let host: HTMLElement;

  async function render(compact = false): Promise<void> {
    TestBed.configureTestingModule({
      imports: [CallControls],
      providers: testProviders({
        provide: CallDevices,
        useValue: {
          preferences: () => ({
            microphone: true,
            camera: true,
            microphoneId: null,
            cameraId: 'cam-2',
          }),
          canShareScreen: () => true,
          list: () =>
            Promise.resolve({
              microphones: [device('audioinput', 'mic-1', '')],
              cameras: [
                device('videoinput', 'cam-1', 'Встроенная'),
                device('videoinput', 'cam-2', 'USB'),
              ],
            }),
        },
      }),
    });
    session = TestBed.inject(CallSession);
    session.phase.set('connected');
    session.participants.set([aParticipant({ camera: aMediaRef() })]);
    fixture = TestBed.createComponent(CallControls);
    fixture.componentRef.setInput('compact', compact);
    await fixture.whenStable();
    host = hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  function button(label: string): HTMLButtonElement {
    const found = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (found === null) {
      throw new Error(`no button ${label}`);
    }
    return found;
  }

  it('toggles the devices and shows their state', async () => {
    await render();
    const toggles = {
      mic: vi.spyOn(session, 'toggleMicrophone').mockResolvedValue(),
      camera: vi.spyOn(session, 'toggleCamera').mockResolvedValue(),
      screen: vi.spyOn(session, 'toggleScreen').mockResolvedValue(),
      minimize: vi.spyOn(session, 'minimize'),
      leave: vi.spyOn(session, 'leave').mockResolvedValue(),
    };

    expect(button('Микрофон').getAttribute('aria-pressed')).toBe('true');
    expect(button('Камера').getAttribute('aria-pressed')).toBe('true');
    expect(button('Показ экрана').getAttribute('aria-pressed')).toBe('false');
    button('Микрофон').click();
    button('Камера').click();
    button('Показ экрана').click();
    button('Свернуть').click();
    button('Выйти из звонка').click();

    expect(Object.values(toggles).every((spy) => spy.mock.calls.length === 1)).toBe(true);

    session.participants.set([aParticipant({ microphone: false, screen: aMediaRef('s') })]);
    await fixture.whenStable();
    expect(button('Микрофон').getAttribute('aria-pressed')).toBe('false');
    expect(button('Микрофон').classList).toContain('tb-call-button--off');
    expect(button('Показ экрана').getAttribute('aria-pressed')).toBe('true');
  });

  it('switches the camera from the devices menu', async () => {
    await render();
    const switched = vi.spyOn(session, 'switchDevice').mockResolvedValue();

    button('Устройства').click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();

    expect(menuItemByText('USB').closest('li')?.classList).toContain('tb-menu-item--selected');
    // above the call window (z-index 1050)
    expect(
      Number(document.querySelector<HTMLElement>('.tb-call-menu')?.style.zIndex),
    ).toBeGreaterThan(1050);
    expect(document.body.textContent).toContain('Микрофон 1');
    menuItemByText('Встроенная').click();
    expect(switched).toHaveBeenCalledWith('videoinput', 'cam-1');
  });

  it('keeps the compact set for the mini window and waits while connecting', async () => {
    await render(true);
    const expand = vi.spyOn(session, 'expand');

    button('Развернуть').click();
    expect(expand).toHaveBeenCalled();
    expect(host.querySelector('button[aria-label="Устройства"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Показ экрана"]')).toBeNull();

    session.phase.set('connecting');
    await fixture.whenStable();
    expect(button('Микрофон').disabled).toBe(true);
    expect(button('Камера').disabled).toBe(true);
  });
});
