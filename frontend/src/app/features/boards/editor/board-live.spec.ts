import { fakeLiveSockets } from '@testing/live-fake';
import {
  BoardLive,
  LiveListener,
  MAX_LIVE_CHARS,
  PING_INTERVAL_MS,
  POINTER_INTERVAL_MS,
  RECONNECT_DELAYS_MS,
  liveUrl,
} from './board-live';

describe('BoardLive', () => {
  let sockets: ReturnType<typeof fakeLiveSockets>;
  let ticket: ReturnType<typeof vi.fn<() => Promise<string>>>;
  let listener: {
    elements: ReturnType<typeof vi.fn<(elements: unknown) => void>>;
    saved: ReturnType<typeof vi.fn<(sceneVersion: number) => void>>;
  };
  let live: BoardLive;

  const teacher = { id: 'p-1', name: 'Учитель', color: 0 };
  const pupil = { id: 'p-2', name: 'Ученица', color: 1 };

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = fakeLiveSockets();
    ticket = vi.fn(() => Promise.resolve('t-1'));
    listener = {
      elements: vi.fn<(elements: unknown) => void>(),
      saved: vi.fn<(v: number) => void>(),
    };
    const events: LiveListener = listener;
    live = new BoardLive({ ticket, open: sockets.open }, events);
  });

  afterEach(() => {
    live.stop();
    vi.useRealTimers();
  });

  /** Starts the channel and lets the server welcome the editor. */
  async function join(peers: unknown[] = [teacher]): Promise<void> {
    live.start();
    await vi.advanceTimersByTimeAsync(0);
    sockets.last().receive({ type: 'welcome', you: 'me', peers });
  }

  it('opens the channel with a ticket and shows who is already there', async () => {
    await join([teacher, { id: 'broken' }]);

    expect(sockets.last().url).toBe(liveUrl('t-1'));
    expect(live.connected()).toBe(true);
    expect(live.peerList()).toEqual([teacher]);
  });

  it('follows the others: joined, cursors, left', async () => {
    await join([]);
    const socket = sockets.last();

    socket.receive({ type: 'joined', peer: pupil });
    socket.receive({ type: 'joined', peer: 'nobody' });
    socket.receive({ type: 'pointer', id: 'p-2', x: 1, y: 2, tool: 'laser', button: 'down' });
    socket.receive({ type: 'pointer', id: 'p-2', x: 'x', y: 2 });
    socket.receive({ type: 'pointer', id: 'stranger', x: 1, y: 2 });
    expect(live.peerList()).toEqual([
      { ...pupil, pointer: { x: 1, y: 2, tool: 'laser', button: 'down' } },
    ]);
    socket.receive({ type: 'pointer', id: 'p-2', x: 3, y: 4 });
    expect(live.peerList()[0]?.pointer).toEqual({ x: 3, y: 4, tool: 'pointer', button: 'up' });

    socket.receive({ type: 'left', id: 'p-2' });
    expect(live.peerList()).toEqual([]);
  });

  it('passes the others’ elements and new scene versions on, ignores the rest', async () => {
    await join();
    const socket = sockets.last();

    socket.receive({ type: 'elements', id: 'p-1', elements: [{ id: 'e' }] });
    socket.receive({ type: 'saved', sceneVersion: 7 });
    socket.receive({ type: 'saved', sceneVersion: 'x' });
    socket.receive({ type: 'pong' });
    socket.receive('not json');
    socket.receive('[1]');
    socket.receiveData(new ArrayBuffer(2));

    expect(listener.elements).toHaveBeenCalledExactlyOnceWith([{ id: 'e' }]);
    expect(listener.saved).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('sends the cursor at most every 50 ms, the latest wins', async () => {
    await join();
    const socket = sockets.last();

    live.pointer({ x: 1, y: 1, tool: 'pointer', button: 'up' });
    live.pointer({ x: 2, y: 2, tool: 'pointer', button: 'down' });
    expect(socket.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(POINTER_INTERVAL_MS);

    expect(socket.sent).toEqual([{ type: 'pointer', x: 2, y: 2, tool: 'pointer', button: 'down' }]);
  });

  it('sends elements only while open and not too big', async () => {
    expect(live.elements([{ id: 'early' }])).toBe(false);
    await join();
    const socket = sockets.last();

    expect(live.elements([{ id: 'e' }])).toBe(true);
    expect(live.elements(['x'.repeat(MAX_LIVE_CHARS)])).toBe(false);
    socket.readyState = 0;
    expect(live.elements([{ id: 'e' }])).toBe(false);

    expect(socket.sent).toEqual([{ type: 'elements', elements: [{ id: 'e' }] }]);
  });

  it('pings so proxies keep the channel', async () => {
    await join();

    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS);

    expect(sockets.last().sent).toEqual([{ type: 'ping' }]);
  });

  it('reconnects after a drop, slower each time, and forgets the others meanwhile', async () => {
    await join();
    sockets.last().drop();
    expect(live.connected()).toBe(false);
    expect(live.peerList()).toEqual([]);

    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);
    expect(sockets.sockets).toHaveLength(2);
    sockets.last().drop();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);
    expect(sockets.sockets).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[1] - RECONNECT_DELAYS_MS[0]);
    expect(sockets.sockets).toHaveLength(3);

    sockets.last().receive({ type: 'welcome', you: 'me', peers: [] });
    sockets.last().drop();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);
    expect(sockets.sockets).toHaveLength(4);
  });

  it('retries when there is no ticket, up to the longest pause', async () => {
    ticket.mockRejectedValue(new Error('offline'));
    live.start();

    for (const delay of [...RECONNECT_DELAYS_MS, RECONNECT_DELAYS_MS.at(-1) ?? 0]) {
      await vi.advanceTimersByTimeAsync(delay);
    }

    expect(ticket).toHaveBeenCalledTimes(RECONNECT_DELAYS_MS.length + 2);
    expect(sockets.sockets).toEqual([]);
  });

  it('gives up when the server took the board away', async () => {
    await join();

    sockets.last().drop(1008);
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS.at(-1) ?? 0);

    expect(sockets.sockets).toHaveLength(1);
  });

  it('stops: closes the channel and ignores what comes late', async () => {
    await join();
    const socket = sockets.last();

    live.stop();
    socket.receive({ type: 'saved', sceneVersion: 2 });
    socket.drop();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);

    expect(socket.closedByEditor).toBe(true);
    expect(live.connected()).toBe(false);
    expect(listener.saved).not.toHaveBeenCalled();
    expect(sockets.sockets).toHaveLength(1);
  });

  it('opens no socket when stopped while the ticket was coming', async () => {
    let give: (value: string) => void = () => undefined;
    ticket.mockReturnValue(new Promise((resolve) => (give = resolve)));
    live.start();

    live.stop();
    give('t-2');
    await vi.advanceTimersByTimeAsync(0);

    expect(sockets.sockets).toEqual([]);
  });

  it('builds the address on the portal’s host', () => {
    expect(liveUrl('a b', 'https://tutor.example/teacher/boards/1')).toBe(
      'wss://tutor.example/api/public/boards/live?ticket=a+b',
    );
    expect(liveUrl('t', 'http://localhost:4200/')).toBe(
      'ws://localhost:4200/api/public/boards/live?ticket=t',
    );
  });
});
