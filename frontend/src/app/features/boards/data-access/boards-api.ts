import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import {
  Board,
  BoardBackup,
  BoardContent,
  BoardFilter,
  BoardInput,
  BoardKind,
  BoardScene,
  MyBoard,
} from './boards.models';

/** HTTP client of the boards module (ADR-0028). */
@Injectable({ providedIn: 'root' })
export class BoardsApi {
  private readonly http = inject(HttpClient);

  list(filter: BoardFilter = {}, context?: HttpContext): Observable<Board[]> {
    let params = new HttpParams();
    if (filter.studentId) params = params.set('studentId', filter.studentId);
    if (filter.groupId) params = params.set('groupId', filter.groupId);
    return this.http.get<Board[]>('/api/teacher/boards', { params, context });
  }

  create(kind: BoardKind, board: BoardInput): Observable<Board> {
    return this.http.post<Board>('/api/teacher/boards', { kind, ...board });
  }

  change(board: Board, input: BoardInput): Observable<Board> {
    return this.http.put<Board>(`/api/teacher/boards/${board.id}`, {
      ...input,
      version: board.version,
    });
  }

  remove(boardId: string): Observable<void> {
    return this.http.delete(`/api/teacher/boards/${boardId}`).pipe(map(() => undefined));
  }

  myBoards(): Observable<MyBoard[]> {
    return this.http.get<MyBoard[]>('/api/me/boards', { context: quietContext() });
  }

  open(boardId: string): Observable<BoardContent> {
    return this.http.get<BoardContent>(`/api/boards/${boardId}`, { context: quietContext() });
  }

  /** The server merges the elements with the others' changes and returns the merged drawing. */
  saveScene(
    boardId: string,
    elements: readonly unknown[],
    appState: Readonly<Record<string, unknown>>,
    baseVersion: number,
  ): Observable<BoardScene> {
    return this.http.put<BoardScene>(
      `/api/boards/${boardId}/scene`,
      { elements, appState, baseVersion },
      { context: quietContext() },
    );
  }

  /** The current user's Excalidraw library (plain JSON items; empty before the first save). */
  library(): Observable<readonly unknown[]> {
    return this.http.get<readonly unknown[]>('/api/boards/library', { context: quietContext() });
  }

  /** Replaces the current user's library; Excalidraw reports a failure itself. */
  saveLibrary(items: readonly unknown[]): Observable<void> {
    return this.http
      .put('/api/boards/library', items, { context: quietContext() })
      .pipe(map(() => undefined));
  }

  /** The drawing when it changed after `since`; `null` while it did not. */
  changes(boardId: string, since: number): Observable<BoardScene | null> {
    return this.http
      .get<BoardScene>(`/api/boards/${boardId}/scene`, {
        params: { since },
        observe: 'response',
        context: quietContext(),
      })
      .pipe(map((response) => (response.status === 204 ? null : response.body)));
  }

  uploadFile(boardId: string, fileId: string, content: Blob): Observable<void> {
    return this.http
      .put(`/api/boards/${boardId}/files/${encodeURIComponent(fileId)}`, content, {
        headers: { 'Content-Type': content.type },
        context: quietContext(),
      })
      .pipe(map(() => undefined));
  }

  file(boardId: string, fileId: string): Observable<Blob> {
    return this.http.get(`/api/boards/${boardId}/files/${encodeURIComponent(fileId)}`, {
      responseType: 'blob',
      context: quietContext(),
    });
  }

  backups(boardId: string): Observable<BoardBackup[]> {
    return this.http.get<BoardBackup[]>(`/api/teacher/boards/${boardId}/backups`, {
      context: quietContext(),
    });
  }

  createBackup(boardId: string): Observable<BoardBackup> {
    return this.http.post<BoardBackup>(`/api/teacher/boards/${boardId}/backups`, null);
  }

  /** @returns the copy of the drawing made before the restore */
  restoreBackup(boardId: string, backupId: string): Observable<BoardBackup> {
    return this.http.post<BoardBackup>(
      `/api/teacher/boards/${boardId}/backups/${backupId}/restore`,
      null,
    );
  }

  deleteBackup(boardId: string, backupId: string): Observable<void> {
    return this.http
      .delete(`/api/teacher/boards/${boardId}/backups/${backupId}`)
      .pipe(map(() => undefined));
  }
}
