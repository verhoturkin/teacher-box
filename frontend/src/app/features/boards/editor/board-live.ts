import { InjectionToken, computed, signal } from '@angular/core';

/** Another editor of the board: the server gives the name and a colour number. */
export interface LivePeer {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly pointer?: LivePointer;
}

/** A cursor in scene coordinates, as Excalidraw reports it. */
export interface LivePointer {
  readonly x: number;
  readonly y: number;
  readonly tool: 'pointer' | 'laser';
  readonly button: 'up' | 'down';
}

/** What the channel tells the editor. */
export interface LiveListener {
  /** Elements another editor changed (not yet checked: they come from the network). */
  elements(elements: unknown): void;
  /** The server has a new scene version. */
  saved(sceneVersion: number): void;
}

/** The part of a `WebSocket` the channel uses (tests pass a fake). */
export interface LiveSocket {
  readonly readyState: number;
  send(text: string): void;
  close(): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  addEventListener(type: 'close', listener: (event: { readonly code: number }) => void): void;
}

/** How the editor reaches the server: tickets and sockets. */
export interface LiveTransport {
  ticket(): Promise<string>;
  open(url: string): LiveSocket;
}

/** Opens a socket: the browser's `WebSocket`; a token so tests replace it. */
export const LIVE_SOCKET = new InjectionToken<(url: string) => LiveSocket>('LIVE_SOCKET', {
  providedIn: 'root',
  factory: () => (url) => new WebSocket(url),
});

/** Waits before the next connection attempt; the last one repeats. */
export const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000] as const;
/** The channel is pinged so proxies keep it open (nginx closes a silent one after 180 s). */
export const PING_INTERVAL_MS = 30000;
/** Cursors go out at most this often. */
export const POINTER_INTERVAL_MS = 50;
/** Bigger changes are not sent live: the others get them with the next save. */
export const MAX_LIVE_CHARS = 500000;

/** The server closes the channel with this when the user lost the board: no reconnect then. */
const POLICY_VIOLATION = 1008;
const OPEN = 1;

/**
 * The live channel of an open board (ADR-0029): a WebSocket opened with a one-time ticket. Shows who
 * else is on the board and where their cursors are, sends this editor's cursor and changed elements,
 * passes the others' elements and new scene versions on. Reconnects by itself; the board keeps working
 * without it (saves and polling).
 */
export class BoardLive {
  readonly connected = signal(false);
  /** Other editors of the board, by id. */
  readonly peers = signal<ReadonlyMap<string, LivePeer>>(new Map());
  readonly peerList = computed(() => [...this.peers().values()]);

  private socket: LiveSocket | undefined;
  private attempt = 0;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private pointerTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingPointer: LivePointer | undefined;

  constructor(
    private readonly transport: LiveTransport,
    private readonly listener: LiveListener,
  ) {}

  start(): void {
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.pointerTimer);
    clearInterval(this.pingTimer);
    this.socket?.close();
    this.socket = undefined;
    this.reset();
  }

  /** This editor's cursor; sent at most every {@link POINTER_INTERVAL_MS}, the latest wins. */
  pointer(pointer: LivePointer): void {
    this.pendingPointer = pointer;
    this.pointerTimer ??= setTimeout(() => {
      this.pointerTimer = undefined;
      const latest = this.pendingPointer;
      this.pendingPointer = undefined;
      if (latest) this.send({ type: 'pointer', ...latest });
    }, POINTER_INTERVAL_MS);
  }

  /** @returns whether the elements went out (the channel is open and they are not too big) */
  elements(elements: readonly unknown[]): boolean {
    const text = JSON.stringify({ type: 'elements', elements });
    return text.length <= MAX_LIVE_CHARS && this.sendText(text);
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    let ticket: string;
    try {
      ticket = await this.transport.ticket();
    } catch {
      this.retry();
      return;
    }
    // stop() may have come while the ticket was on its way.
    if (this.isStopped()) return;
    const socket = this.transport.open(liveUrl(ticket));
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      if (this.socket === socket) this.receive(event.data);
    });
    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      clearInterval(this.pingTimer);
      this.reset();
      if (event.code === POLICY_VIOLATION) this.stopped = true;
      else this.retry();
    });
  }

  /** Read through a method: it changes while a request runs. */
  private isStopped(): boolean {
    return this.stopped;
  }

  private retry(): void {
    if (this.stopped) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  private reset(): void {
    this.connected.set(false);
    this.peers.set(new Map());
  }

  private receive(data: unknown): void {
    const message = parse(data);
    if (message === null) return;
    switch (message['type']) {
      case 'welcome':
        this.welcome(message);
        break;
      case 'joined': {
        const peer = peerOf(message['peer']);
        if (peer) this.updatePeers((peers) => peers.set(peer.id, peer));
        break;
      }
      case 'left':
        this.updatePeers((peers) => peers.delete(String(message['id'])));
        break;
      case 'pointer':
        this.movePointer(message);
        break;
      case 'elements':
        this.listener.elements(message['elements']);
        break;
      case 'saved':
        if (typeof message['sceneVersion'] === 'number')
          this.listener.saved(message['sceneVersion']);
        break;
      default:
      // `pong` and anything newer: nothing to do.
    }
  }

  private welcome(message: Record<string, unknown>): void {
    const peers = Array.isArray(message['peers']) ? message['peers'] : [];
    this.peers.set(
      new Map(
        peers
          .map(peerOf)
          .filter((peer): peer is LivePeer => peer !== null)
          .map((peer) => [peer.id, peer]),
      ),
    );
    this.attempt = 0;
    this.connected.set(true);
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, PING_INTERVAL_MS);
  }

  private movePointer(message: Record<string, unknown>): void {
    const peer = this.peers().get(String(message['id']));
    const { x, y } = message;
    if (peer === undefined || typeof x !== 'number' || typeof y !== 'number') return;
    const pointer: LivePointer = {
      x,
      y,
      tool: message['tool'] === 'laser' ? 'laser' : 'pointer',
      button: message['button'] === 'down' ? 'down' : 'up',
    };
    this.updatePeers((peers) => peers.set(peer.id, { ...peer, pointer }));
  }

  private updatePeers(change: (peers: Map<string, LivePeer>) => unknown): void {
    const peers = new Map(this.peers());
    change(peers);
    this.peers.set(peers);
  }

  private send(message: Record<string, unknown>): void {
    this.sendText(JSON.stringify(message));
  }

  private sendText(text: string): boolean {
    const socket = this.socket;
    if (socket?.readyState !== OPEN || !this.connected()) return false;
    socket.send(text);
    return true;
  }
}

/** The channel's address on the portal's own host: `wss:` under https. */
export function liveUrl(ticket: string, base: string = document.baseURI): string {
  const url = new URL('/api/public/boards/live', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('ticket', ticket);
  return url.href;
}

function parse(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') return null;
  try {
    const value: unknown = JSON.parse(data);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function peerOf(value: unknown): LivePeer | null {
  if (!isRecord(value)) return null;
  const { id, name, color } = value;
  return typeof id === 'string' && typeof name === 'string' && typeof color === 'number'
    ? { id, name, color }
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
