import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { preferences } from '@testing/notification-fixtures';
import { NotificationPreferences } from '../data-access/notifications.models';
import { PreferencesPanel, QUIET_TIMES } from './preferences-panel';

describe('QUIET_TIMES', () => {
  it('offers every half hour of the day', () => {
    expect(QUIET_TIMES).toHaveLength(48);
    expect(QUIET_TIMES[0]).toBe('00:00');
    expect(QUIET_TIMES[47]).toBe('23:30');
  });
});

describe('PreferencesPanel', () => {
  let fixture: ComponentFixture<PreferencesPanel>;
  let backend: HttpTestingController;
  let messages: MessageService;

  async function render(saved: NotificationPreferences, teacher = false): Promise<void> {
    TestBed.configureTestingModule({
      imports: [PreferencesPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG(), MessageService],
    });
    backend = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    fixture = TestBed.createComponent(PreferencesPanel);
    fixture.componentRef.setInput('teacher', teacher);
    fixture.detectChanges();
    backend.expectOne('/api/me/notifications/preferences').flush(saved);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function checkbox(id: string): HTMLInputElement {
    return requireElement(hostElement(fixture), `#${id}`, HTMLInputElement);
  }

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('sends everything by default; a student has no teacher topics', async () => {
    await render(preferences());

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Расписание');
    expect(text).toContain('Сообщения учителя приходят всегда');
    expect(text).not.toContain('Ученики и календарь');
    expect(checkbox('topic-SCHEDULE').checked).toBe(true);
    expect(checkbox('topic-MESSAGES').disabled).toBe(true);
    expect(buttonByText(hostElement(fixture), 'Сохранить').disabled).toBe(true);
  });

  it('mutes a topic and sets quiet hours', async () => {
    await render(preferences(), true);
    expect(readableText(hostElement(fixture))).toContain('Ученики и календарь');

    checkbox('topic-BILLING').click();
    checkbox('quiet-enabled').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(readableText(hostElement(fixture))).toContain('придут в мессенджер, когда тихие часы закончатся');
    fixture.componentInstance.form.controls.quietFrom.setValue('23:00');
    fixture.detectChanges();

    buttonByText(hostElement(fixture), 'Сохранить').click();
    const request = backend.expectOne('/api/me/notifications/preferences');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ mutedTopics: ['BILLING'], quietFrom: '23:00', quietTo: '08:00' });
    request.flush(preferences({ mutedTopics: ['BILLING'], quietFrom: '23:00:00', quietTo: '08:00:00' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Сохранено' }));
    expect(checkbox('topic-BILLING').checked).toBe(false);
    expect(fixture.componentInstance.form.pristine).toBe(true);
  });

  it('shows saved quiet hours and turns them off', async () => {
    await render(preferences({ mutedTopics: ['HOMEWORK'], quietFrom: '21:30:00', quietTo: '07:00:00' }));

    expect(checkbox('topic-HOMEWORK').checked).toBe(false);
    expect(fixture.componentInstance.form.getRawValue()).toEqual(
      expect.objectContaining({ quiet: true, quietFrom: '21:30', quietTo: '07:00' }),
    );

    checkbox('quiet-enabled').click();
    fixture.detectChanges();
    fixture.componentInstance.save();
    fixture.componentInstance.save();
    const request = backend.expectOne('/api/me/notifications/preferences');
    expect(request.request.body).toEqual({ mutedTopics: ['HOMEWORK'], quietFrom: null, quietTo: null });
    request.flush(preferences({ mutedTopics: ['HOMEWORK'] }));
  });

  it('explains a rejected setting', async () => {
    await render(preferences());

    fixture.componentInstance.save();
    backend
      .expectOne('/api/me/notifications/preferences')
      .flush(
        { status: 422, code: 'notification.quiet-hours-invalid' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Укажите начало и конец тихих часов');
  });
});
