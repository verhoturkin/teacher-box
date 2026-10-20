import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { channelSetup, preferences, studentMessengers } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { MessengersSettingsPanel } from './messengers-settings-panel';

describe('MessengersSettingsPanel', () => {
  let fixture: ComponentFixture<MessengersSettingsPanel>;
  let backend: HttpTestingController;

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the bots, own messengers, the bot, the students and what to send, one list reloading the other', async () => {
    TestBed.configureTestingModule({
      imports: [MessengersSettingsPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MessengersSettingsPanel);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
    backend.expectOne('/api/me/channels').flush([]);
    backend
      .expectOne('/api/teacher/notifications/bot')
      .flush({ teacherActions: true, teacherMenu: [], studentMenu: [] });
    backend.expectOne('/api/teacher/notifications/students').flush([studentMessengers()]);
    backend.expectOne('/api/me/notifications/preferences').flush(preferences());
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Мои мессенджеры');
    expect(text).toContain('Что умеет бот');
    expect(text).toContain('Подключили мессенджер');
    expect(text).toContain('Что присылать в мессенджеры');

    fixture.componentInstance.reloadChannels();
    backend.expectOne('/api/me/channels').flush([]);
    fixture.componentInstance.reloadBots();
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
  });
});
