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

const TEACHER = '/api/teacher/homework';
const ME = '/api/me/homework';

/** HTTP client of the homework module. */
@Injectable({ providedIn: 'root' })
export class HomeworkApi {
  private readonly http = inject(HttpClient);

  // --- teacher ---

  assignments(): Observable<AssignmentSummary[]> {
    return this.http.get<AssignmentSummary[]>(`${TEACHER}/assignments`);
  }

  assignment(id: string): Observable<AssignmentDetails> {
    return this.http.get<AssignmentDetails>(`${TEACHER}/assignments/${id}`);
  }

  createAssignment(input: AssignmentInput, studentIds: string[]): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments`, { ...input, studentIds });
  }

  updateAssignment(id: string, input: AssignmentInput, version: number): Observable<AssignmentDetails> {
    return this.http.put<AssignmentDetails>(`${TEACHER}/assignments/${id}`, { ...input, version });
  }

  assignStudents(id: string, studentIds: string[]): Observable<AssignmentDetails> {
    return this.http.post<AssignmentDetails>(`${TEACHER}/assignments/${id}/students`, { studentIds });
  }

  uploadMaterials(id: string, files: readonly File[]): Observable<Attachment[]> {
    return this.http.post<Attachment[]>(`${TEACHER}/assignments/${id}/attachments`, filesForm(files));
  }

  removeMaterial(id: string, attachmentId: string): Observable<unknown> {
    return this.http.delete(`${TEACHER}/assignments/${id}/attachments/${attachmentId}`);
  }

  reviewQueue(): Observable<ReviewQueueItem[]> {
    return this.http.get<ReviewQueueItem[]>(`${TEACHER}/review-queue`);
  }

  task(taskId: string): Observable<TaskDetails> {
    return this.http.get<TaskDetails>(`${TEACHER}/tasks/${taskId}`);
  }

  review(taskId: string, decision: ReviewDecision, grade: string | null, comment: string | null): Observable<TaskDetails> {
    return this.http.post<TaskDetails>(`${TEACHER}/tasks/${taskId}/review`, { decision, grade, comment });
  }

  teacherFile(attachmentId: string): Observable<Blob> {
    return this.http.get(`${TEACHER}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  // --- student ---

  myTasks(): Observable<MyTask[]> {
    return this.http.get<MyTask[]>(ME);
  }

  myTask(taskId: string): Observable<TaskDetails> {
    return this.http.get<TaskDetails>(`${ME}/tasks/${taskId}`);
  }

  submit(taskId: string, text: string | null, files: readonly File[]): Observable<TaskDetails> {
    const form = filesForm(files);
    if (text !== null) {
      form.append('text', text);
    }
    return this.http.post<TaskDetails>(`${ME}/tasks/${taskId}/submissions`, form);
  }

  myFile(attachmentId: string): Observable<Blob> {
    return this.http.get(`${ME}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  summary(): Observable<HomeworkSummary> {
    return this.http.get<HomeworkSummary>('/api/teacher/homework/summary');
  }

  mySummary(): Observable<MyHomeworkSummary> {
    return this.http.get<MyHomeworkSummary>('/api/me/homework/summary');
  }
}

function filesForm(files: readonly File[]): FormData {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }
  return form;
}
