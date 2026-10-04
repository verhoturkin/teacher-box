import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { Board, BoardOwnerRef, MyBoard } from './boards.models';

/** HTTP client of the boards module. */
@Injectable({ providedIn: 'root' })
export class BoardsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Board[]> {
    return this.http.get<Board[]>('/api/teacher/boards');
  }

  add(owner: BoardOwnerRef, title: string | null, url: string): Observable<Board> {
    const ids =
      owner.type === 'GROUP'
        ? { studentId: null, groupId: owner.id }
        : { studentId: owner.id, groupId: null };
    return this.http.post<Board>('/api/teacher/boards', { ...ids, title, url });
  }

  change(board: Board, title: string, url: string): Observable<Board> {
    return this.http.put<Board>(`/api/teacher/boards/${board.id}`, {
      title,
      url,
      version: board.version,
    });
  }

  remove(boardId: string): Observable<void> {
    return this.http.delete(`/api/teacher/boards/${boardId}`).pipe(map(() => undefined));
  }

  myBoards(): Observable<MyBoard[]> {
    return this.http.get<MyBoard[]>('/api/me/boards', { context: quietContext() });
  }
}
