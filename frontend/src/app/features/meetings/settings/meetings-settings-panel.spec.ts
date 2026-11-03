import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { CallsStatus } from '../data-access/meetings.models';
import { MeetingPreferences } from '../telemost';
import { MeetingsSettingsPanel } from './meetings-settings-panel';

describe('MeetingsSettingsPanel', () => {
  let fixture: ComponentFixture<MeetingsSettingsPanel>;
  let backend: HttpTestingController;

  async function render(status: CallsStatus | null): Promise<string> {
    TestBed.configureTestingModule({
      imports: [MeetingsSettingsPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MeetingsSettingsPanel);
    fixture.detectChanges();
    const request = backend.expectOne('/api/teacher/meetings/calls');
    if (status === null) {
      request.flush(null, { status: 500, statusText: 'Error' });
    } else {
      request.flush({ status, rooms: [] });
    }
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('says that calls are on and keeps the desktop application choice on the device', async () => {
    const text = await render('OK');

    expect(text).toContain('Включены — кнопка «Начать урок» у каждого занятия');
    expect(text).toContain('Работает');
    expect(hostElement(fixture).querySelector('a')).toBeNull();
    expect(text).toContain('Своя ссылка на звонок');
    expect(text).toContain('может администратор');
    expect(text).not.toContain('Яндекс');

    fixture.componentInstance.setOpenInApp(false);
    await fixture.whenStable();
    expect(TestBed.inject(MeetingPreferences).openInApp()).toBe(false);
    expect(
      requireElement(hostElement(fixture), '#meetings-open-in-app', HTMLInputElement).checked,
    ).toBe(false);
  });

  it('says when the server is silent, when calls are off and when the status is unknown', async () => {
    expect(await render('UNREACHABLE')).toContain('сервер звонков не отвечает');
    fixture.destroy();
    TestBed.resetTestingModule();
    expect(await render('OFF')).toContain('Не настроены');
    fixture.destroy();
    TestBed.resetTestingModule();
    const unknown = await render(null);
    expect(unknown).not.toContain('Включены');
    expect(unknown).not.toContain('Не настроены');
  });
});
