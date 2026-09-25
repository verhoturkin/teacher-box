import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText } from '@testing/dom';
import { BroadcastDialog } from './broadcast-dialog';

describe('BroadcastDialog', () => {
  let fixture: ComponentFixture<BroadcastDialog>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BroadcastDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BroadcastDialog);
    fixture.componentRef.setInput('students', [{ id: 's-1', displayName: 'Мария' }]);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('sends a message to chosen students', async () => {
    const sent: number[] = [];
    fixture.componentInstance.sent.subscribe((value) => sent.push(value));
    fixture.componentInstance.form.patchValue({ studentIds: ['s-1'], title: ' Перенос ', body: ' В четверг ' });
    await fixture.whenStable();

    buttonByText(document.body, 'Отправить').click();
    const request = backend.expectOne('/api/teacher/notifications/broadcast');
    expect(request.request.body).toEqual({ title: 'Перенос', body: 'В четверг', studentIds: ['s-1'] });
    request.flush({ recipients: 1 });
    await fixture.whenStable();

    expect(sent).toEqual([1]);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('sends to everybody without text body', () => {
    fixture.componentInstance.form.patchValue({ title: 'Всем' });

    fixture.componentInstance.send();

    expect(backend.expectOne('/api/teacher/notifications/broadcast').request.body).toEqual({
      title: 'Всем',
      body: null,
      studentIds: [],
    });
  });

  it('requires a title', () => {
    fixture.componentInstance.send();

    backend.expectNone('/api/teacher/notifications/broadcast');
  });

  it('shows errors and closes on cancel', async () => {
    fixture.componentInstance.form.patchValue({ title: 'Ошибка' });
    fixture.componentInstance.send();
    backend.expectOne('/api/teacher/notifications/broadcast').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Не удалось отправить сообщение');

    buttonByText(document.body, 'Отмена').click();
    expect(fixture.componentInstance.visible()).toBe(false);
  });
});
