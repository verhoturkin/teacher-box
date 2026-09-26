import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { changeRequest, scheduledLesson } from '@testing/schedule-fixtures';
import { ChangeKind, ChangeRequest } from '../data-access/schedule.models';
import { ChangeRequestDialog } from './change-request-dialog';

describe('ChangeRequestDialog', () => {
  let fixture: ComponentFixture<ChangeRequestDialog>;
  let backend: HttpTestingController;
  let sent: ChangeRequest[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChangeRequestDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChangeRequestDialog);
    fixture.componentRef.setInput('lesson', scheduledLesson());
    fixture.componentRef.setInput('lateCancellationMinutes', 1440);
    sent = [];
    fixture.componentInstance.sent.subscribe((request) => sent.push(request));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(kind: ChangeKind, now: Date): Promise<void> {
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('now', now);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  it('proposes another time', async () => {
    await open('RESCHEDULE', new Date(2026, 8, 20));
    expect(bodyText()).toContain('Перенести занятие');
    expect(buttonByText(document.body, 'Отправить учителю').disabled).toBe(true);
    const proposed = new Date(2026, 9, 2, 17);
    fixture.componentInstance.proposed.set(proposed);
    typeInto(requireElement(document.body, '#request-comment', HTMLTextAreaElement), 'Можно в пятницу?');
    await fixture.whenStable();

    buttonByText(document.body, 'Отправить учителю').click();

    const request = backend.expectOne('/api/me/schedule/lessons/l-1/requests');
    expect(request.request.body).toEqual({
      kind: 'RESCHEDULE',
      proposedStartsAt: proposed.toISOString(),
      comment: 'Можно в пятницу?',
    });
    request.flush(changeRequest());
    expect(sent).toHaveLength(1);
  });

  it('warns about a late cancellation', async () => {
    await open('CANCEL', new Date(2026, 9, 1, 12));
    expect(bodyText()).toContain('Отменить занятие');
    expect(bodyText()).toContain('учитель может засчитать его как пропуск');

    buttonByText(document.body, 'Отправить учителю').click();

    const request = backend.expectOne('/api/me/schedule/lessons/l-1/requests');
    expect(request.request.body).toEqual({ kind: 'CANCEL', proposedStartsAt: null, comment: null });
    request.flush({ status: 409, code: 'schedule.request-pending' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(bodyText()).toContain('По этому занятию уже есть запрос');
    expect(sent).toHaveLength(0);
  });

  it('does not warn about an early cancellation', async () => {
    await open('CANCEL', new Date(2026, 8, 20));

    expect(bodyText()).not.toContain('засчитать его как пропуск');
    fixture.componentRef.setInput('kind', 'RESCHEDULE');
    fixture.componentInstance.send();
  });
});
