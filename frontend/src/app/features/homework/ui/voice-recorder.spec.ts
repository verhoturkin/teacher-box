import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { canRecord, VoiceRecorder } from './voice-recorder';

class FakeRecorder {
  static readonly all: FakeRecorder[] = [];
  mimeType = 'audio/webm;codecs=opus';
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor() {
    FakeRecorder.all.push(this);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['sound'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

@Component({
  selector: 'tb-recorder-host',
  imports: [VoiceRecorder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-voice-recorder [(file)]="file" />`,
})
class RecorderHost {
  readonly file = signal<File | null>(null);
  readonly recorder = viewChild.required(VoiceRecorder);
}

describe('VoiceRecorder', () => {
  const stopped: string[] = [];
  // getUserMedia's stream: the recorder only stops its tracks
  let getUserMedia: () => Promise<unknown>;

  beforeEach(() => {
    FakeRecorder.all.length = 0;
    stopped.length = 0;
    getUserMedia = () =>
      Promise.resolve({
        getTracks: () => [{ stop: () => stopped.push('track') }],
      });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => getUserMedia() },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  async function setUp() {
    TestBed.configureTestingModule({ imports: [RecorderHost], providers: [providePrimeNG()] });
    const fixture = TestBed.createComponent(RecorderHost);
    await fixture.whenStable();
    return fixture;
  }

  async function click(fixture: Awaited<ReturnType<typeof setUp>>, label: string): Promise<void> {
    buttonByText(hostElement(fixture), label).click();
    // getUserMedia resolves on the next microtasks
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  it('knows whether the browser records', () => {
    expect(canRecord()).toBe(true);
    vi.stubGlobal('MediaRecorder', undefined);
    expect(canRecord()).toBe(false);
  });

  it('records, shows the time and gives the record to listen to before sending', async () => {
    const fixture = await setUp();
    const host = hostElement(fixture);
    await click(fixture, 'Записать голос');

    expect(readableText(host)).toContain('Идёт запись 0:00');
    await click(fixture, 'Остановить запись');

    const file = fixture.componentInstance.file();
    expect(file?.name).toMatch(/^голос \d\d-\d\d\.webm$/);
    expect(file?.type).toBe('audio/webm');
    expect(stopped).toEqual(['track']);
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('tb-voice-player')).not.toBeNull();
    expect(host.querySelector('[aria-label="Слушать"]')).not.toBeNull();
    expect(readableText(host)).not.toContain('голос');
  });

  it('re-records and deletes the record', async () => {
    const fixture = await setUp();
    await click(fixture, 'Записать голос');
    await click(fixture, 'Остановить запись');

    await click(fixture, 'Перезаписать');
    expect(fixture.componentInstance.file()).toBeNull();
    expect(FakeRecorder.all).toHaveLength(2);
    expect(fixture.componentInstance.recorder().recording()).toBe(true);
    await click(fixture, 'Остановить запись');

    await click(fixture, 'Удалить');
    expect(fixture.componentInstance.file()).toBeNull();
    expect(buttonByText(hostElement(fixture), 'Записать голос')).toBeTruthy();
  });

  it('ignores a second start and drops the take when it goes away', async () => {
    const fixture = await setUp();
    const recorder = fixture.componentInstance.recorder();
    await recorder.start();
    await recorder.start();
    expect(FakeRecorder.all).toHaveLength(1);

    fixture.destroy();
    expect(FakeRecorder.all[0]?.state).toBe('inactive');
    expect(fixture.componentInstance.file()).toBeNull();
  });

  it('names a Safari record m4a and a Firefox one ogg', async () => {
    const fixture = await setUp();
    const names: string[] = [];
    for (const mimeType of ['audio/mp4', 'audio/ogg;codecs=opus', '']) {
      await click(fixture, fixture.componentInstance.file() ? 'Перезаписать' : 'Записать голос');
      const take = FakeRecorder.all.at(-1);
      if (take) {
        take.mimeType = mimeType;
      }
      await click(fixture, 'Остановить запись');
      names.push(fixture.componentInstance.file()?.name.split('.')[1] ?? '');
    }

    expect(names).toEqual(['m4a', 'ogg', 'webm']);
  });

  it('shows a hint when the microphone is denied', async () => {
    getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    const fixture = await setUp();
    await click(fixture, 'Записать голос');

    expect(readableText(hostElement(fixture))).toContain('Нет доступа к микрофону');
    expect(FakeRecorder.all).toHaveLength(0);
  });
});
