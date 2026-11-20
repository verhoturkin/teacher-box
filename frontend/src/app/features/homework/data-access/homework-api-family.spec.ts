import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CHILD_ID, familyScopeOf } from '@testing/family-fixtures';
import { testProviders } from '@testing/setup';
import { HomeworkApi } from './homework-api';

describe('HomeworkApi in the family cabinet', () => {
  it('reads the child’s tasks, quizzes, files and textbooks through the guardian endpoints', () => {
    TestBed.configureTestingModule({ providers: [...testProviders(), familyScopeOf()] });
    const api = TestBed.inject(HomeworkApi);
    const backend = TestBed.inject(HttpTestingController);
    const base = `/api/guardian/students/${CHILD_ID}/homework`;

    api.myTasks().subscribe();
    api.mySummary().subscribe();
    api.myTask('t-1').subscribe();
    api.myQuiz('t-1').subscribe();
    api.myFile('f-1').subscribe();
    api.myTextbook('t-1', 'b-1').subscribe();

    backend.expectOne(base);
    backend.expectOne(`${base}/summary`);
    backend.expectOne(`${base}/tasks/t-1`);
    backend.expectOne(`${base}/tasks/t-1/quiz`);
    backend.expectOne(`${base}/attachments/f-1`);
    backend.expectOne(`${base}/tasks/t-1/textbooks/b-1`);
    backend.verify();
  });
});
