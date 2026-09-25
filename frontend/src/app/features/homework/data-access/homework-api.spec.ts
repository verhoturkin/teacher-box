import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HomeworkApi } from './homework-api';

describe('HomeworkApi', () => {
  let api: HomeworkApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HomeworkApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('calls the teacher endpoints', () => {
    const input = { title: 'Дроби', description: null, dueAt: null };
    api.assignments().subscribe();
    api.assignment('a-1').subscribe();
    api.createAssignment(input, ['s-1']).subscribe();
    api.updateAssignment('a-1', input, 2).subscribe();
    api.assignStudents('a-1', ['s-2']).subscribe();
    api.removeMaterial('a-1', 'f-1').subscribe();
    api.reviewQueue().subscribe();
    api.task('t-1').subscribe();
    api.review('t-1', 'ACCEPT', '5', null).subscribe();
    api.teacherFile('f-1').subscribe();

    backend.expectOne({ method: 'GET', url: '/api/teacher/homework/assignments' });
    backend.expectOne({ method: 'GET', url: '/api/teacher/homework/assignments/a-1' });
    expect(backend.expectOne({ method: 'POST', url: '/api/teacher/homework/assignments' }).request.body).toEqual({
      ...input,
      studentIds: ['s-1'],
    });
    expect(backend.expectOne({ method: 'PUT', url: '/api/teacher/homework/assignments/a-1' }).request.body).toEqual({
      ...input,
      version: 2,
    });
    expect(backend.expectOne('/api/teacher/homework/assignments/a-1/students').request.body).toEqual({
      studentIds: ['s-2'],
    });
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/homework/assignments/a-1/attachments/f-1' });
    backend.expectOne('/api/teacher/homework/review-queue');
    backend.expectOne('/api/teacher/homework/tasks/t-1');
    expect(backend.expectOne('/api/teacher/homework/tasks/t-1/review').request.body).toEqual({
      decision: 'ACCEPT',
      grade: '5',
      comment: null,
    });
    expect(backend.expectOne('/api/teacher/homework/attachments/f-1').request.responseType).toBe('blob');
  });

  it('sends files as multipart form data', () => {
    const file = new File(['x'], 'условие.pdf');
    api.uploadMaterials('a-1', [file]).subscribe();
    api.submit('t-1', 'ответ', [file]).subscribe();
    api.submit('t-1', null, []).subscribe();

    const upload: unknown = backend.expectOne('/api/teacher/homework/assignments/a-1/attachments').request.body;
    expect(upload instanceof FormData ? upload.getAll('files') : []).toHaveLength(1);
    const requests = backend.match('/api/me/homework/tasks/t-1/submissions');
    const withText: unknown = requests[0]?.request.body;
    const withoutText: unknown = requests[1]?.request.body;
    expect(withText instanceof FormData ? withText.get('text') : null).toBe('ответ');
    expect(withoutText instanceof FormData ? withoutText.has('text') : true).toBe(false);
  });

  it('calls the student endpoints', () => {
    api.myTasks().subscribe();
    api.myTask('t-1').subscribe();
    api.myFile('f-1').subscribe();

    backend.expectOne('/api/me/homework');
    backend.expectOne('/api/me/homework/tasks/t-1');
    expect(backend.expectOne('/api/me/homework/attachments/f-1').request.responseType).toBe('blob');
  });
});
