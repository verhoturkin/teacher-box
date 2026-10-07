import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AssignmentDetails,
  AssignmentInput,
  AssignmentSummary,
  Attachment,
  HomeworkSummary,
  MyHomeworkSummary,
  MyTask,
  ReviewDecision,
  ReviewQueueItem,
  TaskDetails,
} from './homework.models';
import { quietContext } from '@core/http/api-error.interceptor';

const TEACHER = '/api/teacher/homework';
const ME = '/api/me/homework';

/** HTTP client of the homework module. */
@Injectable({ providedIn: 'root' })
export class HomeworkApi {
  private readonly http = inject(HttpClient);

  // --- teacher ---

  assignments(): Observable<AssignmentSummary[]> {
    return this.http.get<AssignmentSummary[]>(`${TEACHER}/assignments`, {
      context: quietContext(),
    });
  }

  assignment(id: string): Observable<AssignmentDetails> {
    return this.http.get<AssignmentDetails>(`${TEACHER}/assignments/${id}`, {
      context: quietContext(),
    });
  }

  createAssignment(input: AssignmentInput, studentIds: string[]): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments`, { ...input, studentIds });
  }

  updateAssignment(
    id: string,
    input: AssignmentInput,
    version: number,
  ): Observable<AssignmentDetails> {
    return this.http.put<AssignmentDetails>(`${TEACHER}/assignments/${id}`, { ...input, version });
  }

  assignStudents(id: string, studentIds: string[]): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments/${id}/students`, {
      studentIds,
    });
  }

  uploadMaterials(id: string, files: readonly File[]): Observable<Attachment[]> {
    return this.http.post<Attachment[]>(
      `${TEACHER}/assignments/${id}/attachments`,
      filesForm(files),
    );
  }

  removeMaterial(id: string, attachmentId: string): Observable<unknown> {
    return this.http.delete(`${TEACHER}/assignments/${id}/attachments/${attachmentId}`);
  }

  /** Binds a textbook or changes its pages; `null` pages — the whole textbook. */
  bindTextbook(
    id: string,
    textbookId: string,
    pages: string | null,
  ): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments/${id}/textbooks`, {
      textbookId,
      pages,
    });
  }

  unbindTextbook(id: string, textbookId: string): Observable<AssignmentDetails> {
    return this.http.delete<AssignmentDetails>(
      `${TEACHER}/assignments/${id}/textbooks/${textbookId}`,
    );
  }

  reviewQueue(): Observable<ReviewQueueItem[]> {
    return this.http.get<ReviewQueueItem[]>(`${TEACHER}/review-queue`, {
      context: quietContext(),
    });
  }

  task(taskId: string): Observable<TaskDetails> {
    return this.http.get<TaskDetails>(`${TEACHER}/tasks/${taskId}`, { context: quietContext() });
  }

  review(
    taskId: string,
    decision: ReviewDecision,
    grade: string | null,
    comment: string | null,
  ): Observable<TaskDetails> {
    return this.http.post<TaskDetails>(`${TEACHER}/tasks/${taskId}/review`, {
      decision,
      grade,
      comment,
    });
  }

  teacherFile(attachmentId: string): Observable<Blob> {
    return this.http.get(`${TEACHER}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  // --- student ---

  myTasks(): Observable<MyTask[]> {
    return this.http.get<MyTask[]>(ME, { context: quietContext() });
  }

  myTask(taskId: string): Observable<TaskDetails> {
    return this.http.get<TaskDetails>(`${ME}/tasks/${taskId}`, { context: quietContext() });
  }

  submit(taskId: string, text: string | null, files: readonly File[]): Observable<TaskDetails> {
    const form = filesForm(files);
    if (text !== null) {
      form.append('text', text);
    }
    return this.http.post<TaskDetails>(`${ME}/tasks/${taskId}/submissions`, form);
  }

  /** The bound pages of a textbook (a PDF cut to them). */
  myTextbook(taskId: string, textbookId: string): Observable<Blob> {
    return this.http.get(`${ME}/tasks/${taskId}/textbooks/${textbookId}`, { responseType: 'blob' });
  }

  myFile(attachmentId: string): Observable<Blob> {
    return this.http.get(`${ME}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  summary(): Observable<HomeworkSummary> {
    return this.http.get<HomeworkSummary>('/api/teacher/homework/summary', {
      context: quietContext(),
    });
  }

  mySummary(): Observable<MyHomeworkSummary> {
    return this.http.get<MyHomeworkSummary>('/api/me/homework/summary', {
      context: quietContext(),
    });
  }
}

function filesForm(files: readonly File[]): FormData {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }
  return form;
}
