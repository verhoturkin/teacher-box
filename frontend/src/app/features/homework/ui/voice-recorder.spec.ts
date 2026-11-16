import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { canRecord, formatDuration, VoiceRecorder } from './voice-recorder';

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
  template: `<tb-voice-recorder [(files)]="files" />`,
})
class RecorderHost {
  readonly files = signal<File[]>([]);
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

  it('knows whether the browser records', () => {
    expect(canRecord()).toBe(true);
    vi.stubGlobal('MediaRecorder', undefined);
    expect(canRecord()).toBe(false);
  });

  it('formats the duration', () => {
    expect(formatDuration(7)).toBe('0:07');
    expect(formatDuration(760)).toBe('12:40');
  });

  it('records, shows the duration and puts the record into the files on stop', async () => {
    const fixture = await setUp();
    const host = hostElement(fixture);
    await fixture.componentInstance.recorder().start();
    await fixture.whenStable();

    expect(readableText(host)).toContain('Идёт запись 0:00');
    buttonByText(host, 'Остановить запись').click();
    await fixture.whenStable();

    const [file] = fixture.componentInstance.files();
    expect(file?.name).toMatch(/^голос \d\d-\d\d\.webm$/);
    expect(file?.type).toBe('audio/webm');
    expect(stopped).toEqual(['track']);
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  it('drops the take and starts again on redo; a second start while recording is ignored', async () => {
    const fixture = await setUp();
    const recorder = fixture.componentInstance.recorder();
    await recorder.start();
    await recorder.start();
    await fixture.whenStable();
    expect(FakeRecorder.all).toHaveLength(1);

    buttonByText(hostElement(fixture), 'Записать заново').click();
    await fixture.whenStable();
    expect(FakeRecorder.all).toHaveLength(2);
    expect(fixture.componentInstance.files()).toEqual([]);
    expect(recorder.recording()).toBe(true);

    fixture.destroy();
    expect(FakeRecorder.all[1]?.state).toBe('inactive');
    expect(fixture.componentInstance.files()).toEqual([]);
  });

  it('names a Safari record m4a and a Firefox one ogg', async () => {
    const fixture = await setUp();
    const recorder = fixture.componentInstance.recorder();
    for (const mimeType of ['audio/mp4', 'audio/ogg;codecs=opus']) {
      await recorder.start();
      const take = FakeRecorder.all.at(-1);
      if (take) {
        take.mimeType = mimeType;
      }
      await fixture.whenStable();
      buttonByText(hostElement(fixture), 'Остановить запись').click();
    }

    expect(fixture.componentInstance.files().map((file) => file.name.split('.')[1])).toEqual([
      'm4a',
      'ogg',
    ]);
  });

  it('shows a hint when the microphone is denied', async () => {
    getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    const fixture = await setUp();
    await fixture.componentInstance.recorder().start();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Нет доступа к микрофону');
    expect(FakeRecorder.all).toHaveLength(0);
  });
});
