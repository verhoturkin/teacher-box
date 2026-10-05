import type { Collaborator, SocketId } from '@excalidraw/excalidraw/types';
import type { LivePeer } from './board-live';

/**
 * Cursor colours of the others on a board, by the server's colour number (repeats after the last). Canvas
 * data, not UI: Excalidraw draws the cursor in `stroke` and the name on `background`.
 */
export const PEER_COLORS: readonly { readonly background: string; readonly stroke: string }[] = [
  { background: '#ffc9c9', stroke: '#c92a2a' },
  { background: '#a5d8ff', stroke: '#1864ab' },
  { background: '#b2f2bb', stroke: '#2b8a3e' },
  { background: '#ffec99', stroke: '#e67700' },
  { background: '#eebefa', stroke: '#862e9c' },
  { background: '#99e9f2', stroke: '#0b7285' },
  { background: '#ffd8a8', stroke: '#d9480f' },
  { background: '#fcc2d7', stroke: '#a61e4d' },
];

/** The others on the board as Excalidraw's collaborators: name, colour, cursor. */
export function collaborators(peers: readonly LivePeer[]): Map<SocketId, Collaborator> {
  const result = new Map<SocketId, Collaborator>();
  for (const peer of peers) {
    if (!isSocketId(peer.id)) continue;
    result.set(peer.id, {
      id: peer.id,
      socketId: peer.id,
      username: peer.name,
      color: PEER_COLORS[peer.color % PEER_COLORS.length],
      ...(peer.pointer
        ? {
            pointer: { x: peer.pointer.x, y: peer.pointer.y, tool: peer.pointer.tool },
            button: peer.pointer.button,
          }
        : {}),
    });
  }
  return result;
}

/** A peer id is Excalidraw's socket id (a branded string). */
function isSocketId(id: string): id is SocketId {
  return id.length > 0;
}
