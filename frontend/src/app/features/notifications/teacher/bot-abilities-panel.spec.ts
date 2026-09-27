import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { BotAbilities } from '../data-access/notifications.models';
import { BotAbilitiesPanel } from './bot-abilities-panel';

function abilities(overrides: Partial<BotAbilities> = {}): BotAbilities {
  return { teacherActions: true, teacherMenu: ['Сегодня'], studentMenu: ['Расписание', 'Оплаты'], ...overrides };
}

describe('BotAbilitiesPanel', () => {
  let fixture: ComponentFixture<BotAbilitiesPanel>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BotAbilitiesPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BotAbilitiesPanel);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists the menus of students and of the teacher', async () => {
    backend.expectOne('/api/teacher/notifications/bot').flush(abilities());
    await fixture.whenStable();

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Ученикам Расписание Оплаты');
    expect(text).toContain('Вам Сегодня');
    expect(requireElement(hostElement(fixture), '#bot-teacher-actions', HTMLInputElement).checked).toBe(true);
  });

  it('says when the bot only notifies', async () => {
    backend.expectOne('/api/teacher/notifications/bot').flush(abilities({ teacherMenu: [], studentMenu: [] }));
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Ученикам Пока только уведомления.');
  });

  it('switches managing the portal through the bot', async () => {
    backend.expectOne('/api/teacher/notifications/bot').flush(abilities());
    await fixture.whenStable();

    requireElement(hostElement(fixture), '#bot-teacher-actions', HTMLInputElement).click();
    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/notifications/bot' });
    expect(request.request.body).toEqual({ teacherActions: false });
    request.flush(abilities({ teacherActions: false }));
    await fixture.whenStable();
    expect(requireElement(hostElement(fixture), '#bot-teacher-actions', HTMLInputElement).checked).toBe(false);

    fixture.componentInstance.setTeacherActions(true);
    backend.expectOne({ method: 'PUT', url: '/api/teacher/notifications/bot' }).flush(null, {
      status: 500,
      statusText: 'Error',
    });
    await fixture.whenStable();
    expect(requireElement(hostElement(fixture), '#bot-teacher-actions', HTMLInputElement).checked).toBe(false);
  });
});
