import { Observable, Subject, of, throwError } from 'rxjs';
import { anElement, fakeExcalidraw, fakeScene } from '@testing/excalidraw-fake';
import { BoardScene } from '../data-access/boards.models';
import {
  BROADCAST_DELAY_MS,
  BoardServer,
  BoardSync,
  FILE_FETCHES,
  LIVE_POLL_INTERVAL_MS,
  LiveOutlet,
  POLL_INTERVAL_MS,
  RETRY_DELAY_MS,
  SAVE_DELAY_MS,
} from './board-sync';

const PNG = 'data:image/png;base64,iVBORw==';

/** A server that answers from queues; what the sync sent is kept. */
class FakeServer implements BoardServer {
  readonly saved: { elements: readonly unknown[]; appState: unknown; baseVersion: number }[] = [];
  readonly uploads: string[] = [];
  readonly polls: number[] = [];
  saveAnswers: (() => Observable<BoardScene>)[] = [];
  changesAnswer: () => Observable<BoardScene | null> = () => of(null);
  fileAnswer: (fileId: string) => Observable<Blob> = () =>
    of(new Blob(['x'], { type: 'image/png' }));

  save(
    elements: readonly unknown[],
    appState: Readonly<Record<string, unknown>>,
    baseVersion: number,
  ): Observable<BoardScene> {
    this.saved.push({ elements, appState, baseVersion });
    const answer = this.saveAnswers.shift();
    return answer
      ? answer()
      : of({ sceneVersion: baseVersion + 1, elements: [...elements], appState });
  }

  changes(since: number): Observable<BoardScene | null> {
    this.polls.push(since);
    return this.changesAnswer();
  }

  upload(fileId: string): Observable<void> {
    this.uploads.push(fileId);
    return of(undefined);
  }

  file(fileId: string): Observable<Blob> {
    return this.fileAnswer(fileId);
  }
}

describe('BoardSync', () => {
  let server: FakeServer;
  const island = fakeExcalidraw();

  beforeEach(() => {
    // FileReader stays real: images are read between the timers.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    server = new FakeServer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start(elements = [anElement('a', 1)], sceneVersion = 3) {
    const sync = new BoardSync(server, {
      sceneVersion,
      elements,
      appState: { viewBackgroundColor: '#ffffff' },
    });
    const scene = fakeScene([...elements]);
    sync.attach(scene.access, island.modules);
    return { sync, ...scene };
  }

  it('saves only the changed elements after a pause and applies the answer', async () => {
    const { sync, state, access } = start([anElement('a', 1), anElement('b', 1)]);
    sync.changed(state.elements, access.getAppState());
    expect(server.saved).toEqual([]);
    expect(sync.status()).toBe('saved');

    state.elements = [anElement('a', 2), anElement('b', 1)];
    sync.changed(state.elements, access.getAppState());
    expect(sync.status()).toBe('saving');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    expect(server.saved).toEqual([
      {
        elements: [anElement('a', 2)],
        appState: { viewBackgroundColor: '#ffffff' },
        baseVersion: 3,
      },
    ]);
    expect(sync.status()).toBe('saved');
    state.elements = [anElement('a', 2), anElement('b', 1)];
    sync.changed(state.elements, access.getAppState());
    expect(sync.status()).toBe('saved');
    sync.stop();
  });

  it('saves a new background and takes the others’ elements from the answer', async () => {
    const { sync, state, access } = start();
    server.saveAnswers.push(() =>
      of({
        sceneVersion: 5,
        elements: [anElement('a', 1), anElement('theirs', 1)],
        appState: { viewBackgroundColor: '#000000' },
      }),
    );
    state.appState = { ...state.appState, viewBackgroundColor: '#eeeeee' };
    sync.changed(state.elements, access.getAppState());
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    expect(server.saved[0]?.elements).toEqual([]);
    expect(state.elements.map((element) => element.id)).toEqual(['a', 'theirs']);
    expect(state.appState['viewBackgroundColor']).toBe('#000000');
    sync.stop();
  });

  it('keeps trying while the server is away and says so', async () => {
    const { sync, state, access } = start();
    server.saveAnswers.push(() => throwError(() => new Error('offline')));
    state.elements = [anElement('a', 2)];
    sync.changed(state.elements, access.getAppState());
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(sync.status()).toBe('offline');

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(server.saved).toHaveLength(2);
    expect(sync.status()).toBe('saved');
    sync.stop();
  });

  it('saves what changed during a save right after it', async () => {
    const { sync, state, access } = start();
    const answer = new Subject<BoardScene>();
    server.saveAnswers.push(() => answer);
    state.elements = [anElement('a', 2)];
    sync.changed(state.elements, access.getAppState());
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    state.elements = [anElement('a', 3)];
    sync.changed(state.elements, access.getAppState());
    answer.next({ sceneVersion: 4, elements: [anElement('a', 2)], appState: {} });
    answer.complete();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.status()).toBe('saving');

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(server.saved.map((save) => save.baseVersion)).toEqual([3, 4]);
    expect(sync.status()).toBe('saved');
    sync.stop();
  });

  it('flushes on demand and reports what did not reach the server', async () => {
    const { sync, state, access } = start();
    expect(await sync.flush()).toBe(true);

    state.elements = [anElement('a', 2)];
    sync.changed(state.elements, access.getAppState());
    expect(await sync.flush()).toBe(true);
    expect(server.saved).toHaveLength(1);

    server.saveAnswers.push(() => throwError(() => new Error('offline')));
    state.elements = [anElement('a', 3)];
    sync.changed(state.elements, access.getAppState());
    expect(await sync.flush()).toBe(false);
    sync.stop();
  });

  it('polls for the others’ changes while visible and idle', async () => {
    const { sync, state, access } = start();
    server.changesAnswer = () =>
      of({ sceneVersion: 4, elements: [anElement('a', 1), anElement('b', 2)], appState: {} });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(server.polls).toEqual([3]);
    expect(state.elements.map((element) => element.id)).toEqual(['a', 'b']);
    expect(state.updates).toHaveLength(1);

    server.changesAnswer = () => of(null);
    await sync.poll();
    expect(server.polls).toEqual([3, 4]);

    state.elements = [anElement('a', 5), anElement('b', 2)];
    sync.changed(state.elements, access.getAppState());
    await sync.poll();
    expect(server.polls).toHaveLength(2);
    sync.stop();
  });

  it('polls quietly through errors and not while the tab is hidden', async () => {
    const { sync } = start();
    server.changesAnswer = () => throwError(() => new Error('offline'));
    await sync.poll();
    expect(sync.status()).toBe('saved');

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await sync.poll();
    expect(server.polls).toHaveLength(1);
    visibility.mockRestore();

    sync.stop();
    await sync.poll();
    expect(server.polls).toHaveLength(1);
  });

  it('uploads a new image once and fetches the missing ones', async () => {
    const image = anElement('img', 1, { type: 'image', fileId: 'f-old' });
    const { sync, state, access } = start([image]);
    await vi.waitFor(() => {
      expect(Object.keys(state.files)).toEqual(['f-old']);
    });

    state.files['f-new'] = { id: 'f-new', dataURL: PNG, mimeType: 'image/png' };
    state.elements = [image, anElement('img2', 1, { type: 'image', fileId: 'f-new' })];
    sync.changed(state.elements, access.getAppState());
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    state.elements = [image, anElement('img2', 2, { type: 'image', fileId: 'f-new' })];
    sync.changed(state.elements, access.getAppState());
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    expect(server.uploads).toEqual(['f-new']);
    sync.stop();
  });

  it('fetches the images of the opened drawing while the editor still loads it', async () => {
    const image = anElement('img', 1, { type: 'image', fileId: 'f1' });
    const sync = new BoardSync(server, { sceneVersion: 3, elements: [image], appState: {} });
    const { access, state } = fakeScene([]);
    sync.attach(access, island.modules);
    await vi.waitFor(() => {
      expect(Object.keys(state.files)).toEqual(['f1']);
    });
    sync.stop();
  });

  it('fetches images a few at a time, shows each on arrival and asks for each once', async () => {
    const answers = new Map<string, Subject<Blob>>();
    server.fileAnswer = (fileId) => {
      const answer = new Subject<Blob>();
      answers.set(fileId, answer);
      return answer;
    };
    const images = Array.from({ length: FILE_FETCHES + 1 }, (_, index) =>
      anElement(`img${String(index)}`, 1, { type: 'image', fileId: `f${String(index)}` }),
    );
    const { sync, state } = start(images);
    sync.received([images[0]]);
    expect([...answers.keys()]).toHaveLength(FILE_FETCHES);

    answers.get('f0')?.next(new Blob(['x'], { type: 'image/png' }));
    answers.get('f0')?.complete();
    await vi.waitFor(() => {
      expect(Object.keys(state.files)).toEqual(['f0']);
    });
    expect(answers.has(`f${String(FILE_FETCHES)}`)).toBe(true);
    sync.stop();
  });

  it('leaves an image it cannot fetch as a placeholder', async () => {
    server.fileAnswer = () => throwError(() => new Error('gone'));
    const { sync, state } = start([anElement('img', 1, { type: 'image', fileId: 'f1' })]);
    await vi.advanceTimersByTimeAsync(0);

    expect(state.files).toEqual({});
    sync.stop();
  });

  it('does nothing before the editor is attached', async () => {
    const sync = new BoardSync(server, {
      sceneVersion: 0,
      elements: [],
      appState: {},
    });
    sync.changed([anElement('a', 1)], fakeScene().access.getAppState());
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    expect(server.saved).toEqual([]);
    sync.stop();
  });

  describe('with the live channel', () => {
    /** A channel that is open (or not) and keeps what went out. */
    function outlet(open = true): LiveOutlet & { sent: unknown[][]; open: boolean } {
      const live = {
        sent: [] as unknown[][],
        open,
        connected: () => live.open,
        elements: (elements: readonly unknown[]) => {
          if (live.open) live.sent.push([...elements]);
          return live.open;
        },
      };
      return live;
    }

    it('sends the changed elements to the others at once, each version once', async () => {
      const { sync, state, access } = start([anElement('a', 1)]);
      const live = outlet();
      sync.useLive(live);

      state.elements = [anElement('a', 2), anElement('tiny', 1, { width: 0, height: 0 })];
      sync.changed(state.elements, access.getAppState());
      sync.changed(state.elements, access.getAppState());
      await vi.advanceTimersByTimeAsync(BROADCAST_DELAY_MS);
      expect(live.sent).toEqual([[anElement('a', 2)]]);

      sync.changed(state.elements, access.getAppState());
      await vi.advanceTimersByTimeAsync(BROADCAST_DELAY_MS);
      expect(live.sent).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
      expect(server.saved[0]?.elements).toEqual([anElement('a', 2)]);
    });

    it('leaves the elements to the save while the channel is closed', async () => {
      const { sync, state, access } = start([anElement('a', 1)]);
      const live = outlet(false);
      sync.useLive(live);

      state.elements = [anElement('a', 2)];
      sync.changed(state.elements, access.getAppState());
      await vi.advanceTimersByTimeAsync(BROADCAST_DELAY_MS);
      live.open = true;
      state.elements = [anElement('a', 3)];
      sync.changed(state.elements, access.getAppState());
      await vi.advanceTimersByTimeAsync(BROADCAST_DELAY_MS);

      expect(live.sent).toEqual([[anElement('a', 3)]]);
    });

    it('takes the others’ elements without saving them again', async () => {
      const { sync, state, access } = start([anElement('a', 1)]);
      sync.useLive(outlet());

      sync.received([anElement('b', 1, { type: 'image', fileId: 'f-1' }), anElement('a', 2)]);
      sync.received('not elements');
      sync.received([{ id: 'no version' }]);
      sync.changed(state.elements, access.getAppState());
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

      expect(state.elements.map((element) => `${element.id}:${String(element.version)}`)).toEqual([
        'a:2',
        'b:1',
      ]);
      expect(state.updates.at(-1)).toMatchObject({ captureUpdate: 'NEVER' });
      expect(server.saved).toEqual([]);
      expect(sync.status()).toBe('saved');
      await vi.waitFor(() => {
        expect(state.files['f-1']).toBeDefined();
      });
    });

    it('fetches the scene when the server has a newer one', async () => {
      const { sync } = start([], 3);
      sync.useLive(outlet());

      sync.saved(3);
      await vi.advanceTimersByTimeAsync(0);
      expect(server.polls).toEqual([]);

      sync.saved(4);
      await vi.advanceTimersByTimeAsync(0);
      expect(server.polls).toEqual([3]);
    });

    it('polls rarely while the channel is open', async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
      });
      const { sync } = start([], 3);
      const live = outlet();
      sync.useLive(live);

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(server.polls).toEqual([3]);
      await vi.advanceTimersByTimeAsync(LIVE_POLL_INTERVAL_MS - POLL_INTERVAL_MS);
      expect(server.polls).toEqual([3]);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(server.polls).toEqual([3, 3]);

      live.open = false;
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(server.polls).toEqual([3, 3, 3]);
      sync.stop();
    });

    it('sends nothing after stop', async () => {
      const { sync, state, access } = start([anElement('a', 1)]);
      const live = outlet();
      sync.useLive(live);

      state.elements = [anElement('a', 2)];
      sync.changed(state.elements, access.getAppState());
      sync.stop();
      sync.received([anElement('b', 1)]);
      await vi.advanceTimersByTimeAsync(BROADCAST_DELAY_MS);

      expect(live.sent).toEqual([]);
      expect(state.elements.map((element) => element.id)).toEqual(['a']);
    });
  });

  it('does not save a shape too small to see', async () => {
    const { sync, state, access } = start([anElement('a', 1)]);

    state.elements = [
      anElement('a', 1),
      anElement('dot', 1, { width: 0, height: 0 }),
      anElement('line', 1, { type: 'line', points: [[0, 0]] }),
      anElement('gone', 2, { width: 0, height: 0, isDeleted: true }),
      anElement('arrow', 1, {
        type: 'arrow',
        points: [
          [0, 0],
          [5, 5],
        ],
      }),
    ];
    sync.changed(state.elements, access.getAppState());
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

    expect(server.saved[0]?.elements).toEqual([
      expect.objectContaining({ id: 'gone' }),
      expect.objectContaining({ id: 'arrow' }),
    ]);
  });
});
