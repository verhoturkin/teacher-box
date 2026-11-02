import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { channelSetup, studentMessengers } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { MessengersSettingsPanel } from './messengers-settings-panel';

describe('MessengersSettingsPanel', () => {
  let fixture: ComponentFixture<MessengersSettingsPanel>;
  let backend: HttpTestingController;

  afterEach(() => {
    fixture.destroy();
    backend.verify();
  });

  it('shows the bots, what the bot can do and the students', async () => {
    TestBed.configureTestingModule({
      imports: [MessengersSettingsPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MessengersSettingsPanel);
    fixture.detectChanges();
    backend.expectOne('/api/teacher/notifications/channels').flush([channelSetup()]);
    backend
      .expectOne('/api/teacher/notifications/bot')
      .flush({ teacherActions: true, teacherMenu: [], studentMenu: [] });
    backend.expectOne('/api/teacher/notifications/students').flush([studentMessengers()]);
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).not.toContain('Мои мессенджеры');
    expect(text).toContain('Что умеет бот');
    expect(text).toContain('0 из 1 получают уведомления в мессенджере');
    expect(text).toContain('Боты');
  });
});
