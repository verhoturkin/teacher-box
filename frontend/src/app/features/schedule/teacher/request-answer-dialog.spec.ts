import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { changeRequest, scheduledLesson } from '@testing/schedule-fixtures';
import { ChangeRequest } from '../data-access/schedule.models';
import { RequestAnswerDialog } from './request-answer-dialog';

describe('RequestAnswerDialog', () => {
  let fixture: ComponentFixture<RequestAnswerDialog>;
  let backend: HttpTestingController;
  let answered: ChangeRequest[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestAnswerDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RequestAnswerDialog);
    answered = [];
    fixture.componentInstance.answered.subscribe((request) => answered.push(request));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(request: ChangeRequest): Promise<void> {
    fixture.componentRef.setInput('request', request);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  it('approves a move for the proposed time', async () => {
    const request = changeRequest({ comment: 'Можно в пятницу?' });
    await open(request);
    expect(bodyText()).toContain('Иван Петров: перенос занятия');
    expect(bodyText()).toContain('«Можно в пятницу?»');
    typeInto(requireElement(document.body, '#answer-comment', HTMLTextAreaElement), ' Договорились ');

    buttonByText(document.body, 'Согласовать').click();

    const call = backend.expectOne('/api/teacher/schedule/requests/r-1/approve');
    expect(call.request.body).toEqual({ startsAt: request.proposedStartsAt, charge: false, answer: 'Договорились' });
    call.flush(scheduledLesson());
    expect(answered).toEqual([request]);
  });

  it('suggests charging a late cancellation', async () => {
    await open(changeRequest({ kind: 'CANCEL', proposedStartsAt: null, late: true, studentName: null }));
    expect(bodyText()).toContain('Ученик: отмена занятия');
    expect(bodyText()).toContain('Отмена поздняя');

    buttonByText(document.body, 'Согласовать').click();

    expect(backend.expectOne('/api/teacher/schedule/requests/r-1/approve').request.body).toEqual({
      startsAt: null,
      charge: true,
      answer: null,
    });
  });

  it('declines with a comment', async () => {
    await open(changeRequest({ kind: 'CANCEL', proposedStartsAt: null }));

    buttonByText(document.body, 'Отклонить').click();

    const call = backend.expectOne('/api/teacher/schedule/requests/r-1/decline');
    expect(call.request.body).toEqual({ answer: null });
    call.flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(answered).toHaveLength(0);
    fixture.componentRef.setInput('request', null);
    fixture.componentInstance.approve();
  });
});
