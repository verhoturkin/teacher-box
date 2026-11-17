import { CallParticipant } from './call-engine';

/** What a tile shows: a participant's camera or their shared screen. */
export interface StageView {
  readonly participant: CallParticipant;
  readonly screen: boolean;
}

/**
 * The stage of the full window:
 * - `alone` — only this user, their tile in the middle, «waiting» under it;
 * - `pair` — the other one on the stage, this user in a small movable tile (`CallSelf`);
 * - `grid` — three or more, equal tiles;
 * - `screen` — a shared screen on the stage, everyone in a strip.
 */
export interface StageLayout {
  readonly kind: 'alone' | 'pair' | 'grid' | 'screen';
  readonly main: StageView | null;
  readonly inset: CallParticipant | null;
  readonly tiles: readonly CallParticipant[];
}

export function stageLayout(participants: readonly CallParticipant[]): StageLayout {
  const local = participants.find((person) => person.local) ?? null;
  const others = participants.filter((person) => !person.local);
  const sharing = others.find((person) => person.screen !== null) ?? (local?.screen ? local : null);
  if (sharing !== null) {
    return {
      kind: 'screen',
      main: { participant: sharing, screen: true },
      inset: null,
      tiles: [...others, ...(local === null ? [] : [local])],
    };
  }
  const [only] = others;
  if (only === undefined) {
    return {
      kind: 'alone',
      main: local === null ? null : { participant: local, screen: false },
      inset: null,
      tiles: [],
    };
  }
  if (others.length === 1) {
    return { kind: 'pair', main: { participant: only, screen: false }, inset: local, tiles: [] };
  }
  return {
    kind: 'grid',
    main: null,
    inset: null,
    tiles: [...others, ...(local === null ? [] : [local])],
  };
}

/** Columns and rows of the grid: as square as possible, at most two columns on a phone. */
export function gridSize(count: number, portrait: boolean): { columns: number; rows: number } {
  const square = Math.ceil(Math.sqrt(Math.max(count, 1)));
  const columns = portrait ? Math.max(1, Math.min(square, 2)) : square;
  return { columns, rows: Math.ceil(Math.max(count, 1) / columns) };
}

/** `m:ss` or `h:mm:ss` of the call. */
export function elapsedText(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${String(minutes)}:${seconds}`;
}
