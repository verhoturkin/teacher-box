import { Injectable } from '@angular/core';

/** How a material goes on a board: as a text element or as a picture of the formatted text. */
export type InsertMode = 'text' | 'image';

/** A material waiting for its board to open (a task, a draft of the AI). */
export interface BoardMaterial {
  readonly title: string;
  readonly markdown: string;
  readonly mode: InsertMode;
}

interface StoredMaterial extends BoardMaterial {
  readonly at: number;
}

const PREFIX = 'tb.board-insert.';
/** A material not picked up by then (the tab did not open) is forgotten. */
export const INSERT_TTL_MS = 2 * 60 * 1000;

/**
 * Hands a material from «На доску» to the board editor opened in a new tab: kept in the browser's
 * storage for a short while and taken once (the tabs share nothing else).
 */
@Injectable({ providedIn: 'root' })
export class BoardInsert {
  put(boardId: string, material: BoardMaterial, now = Date.now()): void {
    try {
      localStorage.setItem(PREFIX + boardId, JSON.stringify({ ...material, at: now }));
    } catch {
      // Without storage the board opens without the material.
    }
  }

  /** The material for this board, once; `null` when there is none or it is too old. */
  take(boardId: string, now = Date.now()): BoardMaterial | null {
    try {
      const text = localStorage.getItem(PREFIX + boardId);
      localStorage.removeItem(PREFIX + boardId);
      if (text === null) return null;
      const stored: unknown = JSON.parse(text);
      return isMaterial(stored) && now - stored.at <= INSERT_TTL_MS
        ? { title: stored.title, markdown: stored.markdown, mode: stored.mode }
        : null;
    } catch {
      return null;
    }
  }
}

function isMaterial(value: unknown): value is StoredMaterial {
  if (typeof value !== 'object' || value === null) return false;
  const material = value as Partial<Record<keyof StoredMaterial, unknown>>;
  return (
    typeof material.title === 'string' &&
    typeof material.markdown === 'string' &&
    (material.mode === 'text' || material.mode === 'image') &&
    typeof material.at === 'number'
  );
}
