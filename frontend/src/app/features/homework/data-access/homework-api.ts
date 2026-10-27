import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import {
  AssignmentDetails,
  AssignmentInput,
  AssignmentSummary,
  Attachment,
  HomeworkLimits,
  HomeworkSummary,
  MyHomeworkSummary,
  MyTask,
  ReviewDecision,
  ReviewQueueItem,
  TaskDetails,
  VideoTranscript,
  CaptionTrack,
  CaptionTracks,
} from './homework.models';
import { quietContext } from '@core/http/api-error.interceptor';

const TEACHER = '/api/teacher/homework';
const ME = '/api/me/homework';

/** HTTP client of the homework module. */
@Injectable({ providedIn: 'root' })
export class HomeworkApi {
  private readonly http = inject(HttpClient);
  private limitsRequest: Observable<HomeworkLimits> | undefined;

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

  /** Without students: the editor adds the materials first, then gives the assignment out. */
  createAssignment(input: AssignmentInput): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments`, input);
  }

  /** A draft copy with the text, files, textbooks and videos; no students, deadline or board. */
  copyAssignment(id: string): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments/${id}/copy`, {});
  }

  updateAssignment(
    id: string,
    input: AssignmentInput,
    version: number,
  ): Observable<AssignmentDetails> {
    return this.http.put<AssignmentDetails>(`${TEACHER}/assignments/${id}`, { ...input, version });
  }

  /** «Взять субтитры с YouTube» (ADR-0047): the caption tracks; errors are shown by the video card, not a toast. */
  videoCaptions(url: string): Observable<CaptionTracks> {
    return this.http.post<CaptionTracks>(
      `${TEACHER}/videos/captions`,
      { url },
      { context: quietContext() },
    );
  }

  /** The captions of the chosen track as a transcript; errors are shown by the video card, not a toast. */
  videoTranscript(url: string, track: CaptionTrack): Observable<VideoTranscript> {
    return this.http.post<VideoTranscript>(
      `${TEACHER}/videos/transcript`,
      { url, language: track.language, automatic: track.automatic },
      { context: quietContext() },
    );
  }

  /** Deletes the assignment with the students' answers and every file. */
  deleteAssignment(id: string): Observable<unknown> {
    return this.http.delete(`${TEACHER}/assignments/${id}`);
  }

  assignStudents(id: string, studentIds: string[]): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments/${id}/students`, {
      studentIds,
    });
  }

  /** Remembers the board the assignment was put on; `null` forgets it. */
  placeOnBoard(id: string, boardId: string | null): Observable<AssignmentDetails> {
    return this.http.put<AssignmentDetails>(`${TEACHER}/assignments/${id}/board`, { boardId });
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

  /** The tasks of one student, every status. */
  studentTasks(studentId: string): Observable<MyTask[]> {
    return this.http.get<MyTask[]>(`${TEACHER}/students/${studentId}/tasks`, {
      context: quietContext(),
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

  /** Asked once: the limits change only with the server settings. */
  limits(): Observable<HomeworkLimits> {
    this.limitsRequest ??= this.http
      .get<HomeworkLimits>(`${ME}/limits`, { context: quietContext() })
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.limitsRequest;
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
