import type { LiveSocket } from '@features/boards/editor/board-live';

type MessageListener = (event: { readonly data: unknown }) => void;
type CloseListener = (event: { readonly code: number }) => void;
/** Gets an event fit for both kinds of listener. */
type AnyListener = (event: { readonly data: unknown; readonly code: number }) => void;

/** A WebSocket of the live channel on plain data: what the editor sent, and the server's side. */
export class FakeLiveSocket implements LiveSocket {
  readyState = 1;
  readonly sent: unknown[] = [];
  closedByEditor = false;
  private readonly listeners: { readonly type: string; readonly listener: AnyListener }[] = [];

  constructor(readonly url: string) {}

  send(text: string): void {
    this.sent.push(JSON.parse(text));
  }

  close(): void {
    this.closedByEditor = true;
    this.readyState = 3;
  }

  addEventListener(type: 'message', listener: MessageListener): void;
  addEventListener(type: 'close', listener: CloseListener): void;
  addEventListener(type: string, listener: AnyListener): void {
    this.listeners.push({ type, listener });
  }

  /** The server sends a message (an object as JSON, or raw data as is). */
  receive(message: unknown): void {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.emit('message', { data, code: 0 });
  }

  /** A frame that is not text (e.g. binary). */
  receiveData(data: unknown): void {
    this.emit('message', { data, code: 0 });
  }

  /** The server or the network closes the channel. */
  drop(code = 1006): void {
    this.readyState = 3;
    this.emit('close', { data: null, code });
  }

  private emit(type: string, event: { readonly data: unknown; readonly code: number }): void {
    for (const entry of this.listeners) if (entry.type === type) entry.listener(event);
  }
}

/** Opens fake sockets and keeps them, the newest last. */
export function fakeLiveSockets(): {
  readonly sockets: FakeLiveSocket[];
  readonly open: (url: string) => FakeLiveSocket;
  last(): FakeLiveSocket;
} {
  const sockets: FakeLiveSocket[] = [];
  return {
    sockets,
    open: (url) => {
      const socket = new FakeLiveSocket(url);
      sockets.push(socket);
      return socket;
    },
    last: () => {
      const socket = sockets.at(-1);
      if (!socket) throw new Error('No socket was opened');
      return socket;
    },
  };
}
