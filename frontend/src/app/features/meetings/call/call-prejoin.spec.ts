import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { CallDevices, DeviceList } from './call-devices';
import { CallMedia } from './call-engine';
import { CallPrejoin } from './call-prejoin';
import { CallSession } from './call-session';

function device(kind: MediaDeviceKind, deviceId: string): MediaDeviceInfo {
  return { kind, deviceId, label: '', groupId: 'g', toJSON: () => ({}) };
}

class FakeStream {
  readonly stopped: string[] = [];
  constructor(private readonly name: string) {}
  getTracks() {
    return [{ stop: () => this.stopped.push(this.name) }];
  }
}

describe('CallPrejoin', () => {
  let fixture: ComponentFixture<CallPrejoin>;
  let session: CallSession;
  let previews: CallMedia[];
  let streams: FakeStream[];
  let failWith: Error | null;
  let list: DeviceList;

  async function render(supported = true, switching: string | null = null): Promise<void> {
    previews = [];
    streams = [];
    failWith = null;
    TestBed.configureTestingModule({
      imports: [CallPrejoin],
      providers: testProviders({
        provide: CallDevices,
        useValue: {
          supported: () => supported,
          preferences: () => ({
            microphone: true,
            camera: true,
            microphoneId: null,
            cameraId: null,
          }),
          remember: () => undefined,
          preview: (media: CallMedia) => {
            previews.push(media);
            if (failWith !== null) {
              return Promise.reject(failWith);
            }
            const stream = new FakeStream(`s${String(previews.length)}`);
            streams.push(stream);
            return Promise.resolve(stream);
          },
          list: () => Promise.resolve(list),
        },
      }),
    });
    session = TestBed.inject(CallSession);
    fixture = TestBed.createComponent(CallPrejoin);
    fixture.componentRef.setInput('target', { ownerId: 'g-1', title: 'ОГЭ' });
    fixture.componentRef.setInput('switching', switching);
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  beforeEach(() => {
    list = {
      microphones: [device('audioinput', 'mic-1')],
      cameras: [device('videoinput', 'cam-1')],
    };
  });

  afterEach(() => {
    fixture.destroy();
  });

  function toggle(label: string): HTMLButtonElement {
    const found = document.body.querySelector<HTMLButtonElement>(
      `.tb-call-prejoin button[aria-label="${label}"]`,
    );
    if (found === null) {
      throw new Error(`no toggle ${label}`);
    }
    return found;
  }

  it('previews the camera and joins with the chosen devices', async () => {
    await render();
    const join = vi.spyOn(session, 'join').mockResolvedValue();

    expect(bodyText()).toContain('Звонок: ОГЭ');
    expect(previews).toEqual([
      { microphone: true, camera: true, microphoneId: null, cameraId: null },
    ]);
    expect(document.body.querySelector('.tb-call-prejoin video')).not.toBeNull();

    toggle('Микрофон').click();
    await settle();
    expect(toggle('Микрофон').getAttribute('aria-pressed')).toBe('false');
    expect(streams[0]?.stopped).toEqual(['s1']);
    toggle('Камера').click();
    await settle();
    expect(document.body.querySelector('.tb-call-prejoin video')).toBeNull();

    buttonByText(document.body, 'Войти').click();
    expect(join).toHaveBeenCalledWith({
      microphone: false,
      camera: false,
      microphoneId: null,
      cameraId: null,
    });
  });

  it('chooses among several devices', async () => {
    list = {
      microphones: [device('audioinput', 'mic-1'), device('audioinput', 'mic-2')],
      cameras: [device('videoinput', 'cam-1'), device('videoinput', 'cam-2')],
    };
    await render();

    expect(document.body.querySelector('#call-microphone')).not.toBeNull();
    expect(bodyText()).toContain('Микрофон 1');
    const component = fixture.componentInstance;
    component.update({ cameraId: 'cam-2' });
    component.update({ cameraId: 'cam-2' });
    component.update({ microphoneId: 'mic-2' });
    await settle();

    expect(previews.map((media) => [media.microphoneId, media.cameraId])).toEqual([
      [null, null],
      [null, 'cam-2'],
      ['mic-2', 'cam-2'],
    ]);
  });

  it('says why the camera is not shown and when another call ends', async () => {
    previews = [];
    await render(true, 'Анна');
    failWith = Object.assign(new Error('denied'), { name: 'NotAllowedError' });

    toggle('Камера').click();
    toggle('Камера').click();
    await settle();

    expect(bodyText()).toContain('Браузер не дал доступ к камере и микрофону');
    expect(bodyText()).toContain('Звонок «Анна» завершится.');
  });

  it('closes on «Отмена» and stops the preview', async () => {
    await render();
    const cancel = vi.spyOn(session, 'cancelPrejoin');

    buttonByText(document.body, 'Отмена').click();
    fixture.destroy();

    expect(cancel).toHaveBeenCalled();
    expect(streams[0]?.stopped).toEqual(['s1']);
  });

  it('explains a browser without calls', async () => {
    await render(false);

    expect(previews).toEqual([]);
    expect(bodyText()).toContain('Этот браузер не умеет видеозвонки');
    expect(buttonByText(document.body, 'Войти').disabled).toBe(true);
  });
});
