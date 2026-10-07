import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { MyTextbook, Textbook, TextbookInput } from './textbooks.models';

/** HTTP client of the textbooks module (ADR-0033). */
@Injectable({ providedIn: 'root' })
export class TextbooksApi {
  private readonly http = inject(HttpClient);

  /** All textbooks, newest first. */
  list(context?: HttpContext): Observable<Textbook[]> {
    return this.http.get<Textbook[]>('/api/teacher/textbooks', { context });
  }

  create(input: TextbookInput, file: File): Observable<Textbook> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('kind', input.kind);
    form.append('title', input.title);
    if (input.course !== null) form.append('course', input.course);
    if (input.pageCount !== null) form.append('pageCount', String(input.pageCount));
    input.studentIds.forEach((id) => {
      form.append('studentIds', id);
    });
    input.groupIds.forEach((id) => {
      form.append('groupIds', id);
    });
    return this.http.post<Textbook>('/api/teacher/textbooks', form);
  }

  change(textbook: Textbook, input: TextbookInput): Observable<Textbook> {
    return this.http.put<Textbook>(`/api/teacher/textbooks/${textbook.id}`, {
      ...input,
      version: textbook.version,
    });
  }

  replaceFile(textbook: Textbook, file: File): Observable<Textbook> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('version', String(textbook.version));
    return this.http.put<Textbook>(`/api/teacher/textbooks/${textbook.id}/file`, form);
  }

  remove(textbookId: string): Observable<void> {
    return this.http.delete(`/api/teacher/textbooks/${textbookId}`).pipe(map(() => undefined));
  }

  file(textbookId: string): Observable<Blob> {
    return this.http.get(`/api/teacher/textbooks/${textbookId}/file`, { responseType: 'blob' });
  }

  myTextbooks(): Observable<MyTextbook[]> {
    return this.http.get<MyTextbook[]>('/api/me/textbooks', { context: quietContext() });
  }

  myFile(textbookId: string): Observable<Blob> {
    return this.http.get(`/api/me/textbooks/${textbookId}/file`, { responseType: 'blob' });
  }
}

/** The picture of a page for a board (fetched with the teacher's token). */
export function textbookPageUrl(textbookId: string, page: number): string {
  return `/api/teacher/textbooks/${textbookId}/pages/${String(page)}`;
}
