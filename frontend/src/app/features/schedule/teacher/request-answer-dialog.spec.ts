import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { changeRequest, scheduledLesson } from '@testing/schedule-fixtures';
import { ChangeRequest } from '../data-access/schedule.models';
import { RequestAnswerDialog } from './request-answer-dialog';
import { testProviders } from '@testing/setup';

describe('RequestAnswerDialog', () => {
  let fixture: ComponentFixture<RequestAnswerDialog>;
  let backend: HttpTestingController;
  let answered: ChangeRequest[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestAnswerDialog],
      providers: testProviders(),
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
    typeInto(
      requireElement(document.body, '#answer-comment', HTMLTextAreaElement),
      ' Договорились ',
    );

    buttonByText(document.body, 'Согласовать').click();

    const call = backend.expectOne('/api/teacher/schedule/requests/r-1/approve');
    expect(call.request.body).toEqual({
      startsAt: request.proposedStartsAt,
      charge: false,
      answer: 'Договорились',
      allowBusy: false,
    });
    call.flush(scheduledLesson());
    expect(answered).toEqual([request]);
  });

  it('moves into busy time only when the teacher confirms', async () => {
    const request = changeRequest();
    await open(request);
    buttonByText(document.body, 'Согласовать').click();
    backend
      .expectOne('/api/teacher/schedule/requests/r-1/approve')
      .flush({ status: 409, code: 'schedule.slot-busy' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(bodyText()).toContain('В это время у вас другое занятие');
    expect(answered).toHaveLength(0);

    buttonByText(document.body, 'Всё равно перенести').click();
    const forced = backend.expectOne('/api/teacher/schedule/requests/r-1/approve');
    expect(forced.request.body).toEqual(expect.objectContaining({ allowBusy: true }));
    forced.flush(scheduledLesson());
    expect(answered).toEqual([request]);
  });

  it('suggests charging a late cancellation', async () => {
    await open(
      changeRequest({ kind: 'CANCEL', proposedStartsAt: null, late: true, studentName: null }),
    );
    expect(bodyText()).toContain('Ученик: отмена занятия');
    expect(bodyText()).toContain('Отмена поздняя');

    buttonByText(document.body, 'Согласовать').click();

    expect(backend.expectOne('/api/teacher/schedule/requests/r-1/approve').request.body).toEqual({
      startsAt: null,
      charge: true,
      answer: null,
      allowBusy: false,
    });
  });

  it('declines with a comment', async () => {
    await open(changeRequest({ kind: 'CANCEL', proposedStartsAt: null }));

    buttonByText(document.body, 'Отклонить').click();

    const call = backend.expectOne('/api/teacher/schedule/requests/r-1/decline');
    expect(call.request.body).toEqual({ answer: null });
    call.flush(null, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();
    expect(answered).toHaveLength(0);
    expect(bodyText()).toContain('Не удалось ответить на запрос');
    fixture.componentRef.setInput('request', null);
    fixture.componentInstance.approve();
  });

  it('explains requests about group lessons', async () => {
    await open(
      changeRequest({
        kind: 'CANCEL',
        groupId: 'g-1',
        groupName: 'ОГЭ',
        proposedStartsAt: null,
        late: true,
      }),
    );
    expect(bodyText()).toContain('не придёт на занятие группы «ОГЭ»');
    fixture.componentRef.setInput('visible', false);
    await fixture.whenStable();

    await open(changeRequest({ id: 'r-2', groupId: 'g-1', groupName: 'ОГЭ' }));
    expect(bodyText()).toContain('занятие перенесётся для всех');
  });
});
