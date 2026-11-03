import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { BotAbilities } from '../data-access/notifications.models';
import { BotAbilitiesPanel } from './bot-abilities-panel';
import { screenWidth, testProviders } from '@testing/setup';

function abilities(overrides: Partial<BotAbilities> = {}): BotAbilities {
  return {
    teacherActions: true,
    teacherMenu: ['Сегодня'],
    studentMenu: ['Расписание', 'Оплаты'],
    ...overrides,
  };
}

describe('BotAbilitiesPanel', () => {
  let fixture: ComponentFixture<BotAbilitiesPanel>;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BotAbilitiesPanel],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BotAbilitiesPanel);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('is folded and unfolds to the menus of students and of the teacher', async () => {
    backend.expectOne('/api/teacher/notifications/bot').flush(abilities());
    await fixture.whenStable();
    const toggle = buttonByText(hostElement(fixture), 'Что умеет бот');
    const body = hostElement(fixture).querySelector<HTMLElement>('#tb-bot-abilities');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body?.hidden).toBe(false);

    const text = readableText(hostElement(fixture));
    expect(text).toContain('Ученикам Расписание, Оплаты');
    expect(text).toContain('Вам Сегодня');
  });

  it('says when the bot only notifies', async () => {
    backend
      .expectOne('/api/teacher/notifications/bot')
      .flush(abilities({ teacherMenu: [], studentMenu: [] }));
    await fixture.whenStable();

    expect(readableText(hostElement(fixture))).toContain('Ученикам Пока только уведомления.');
  });

  it('on a phone opens its own screen instead of unfolding', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BotAbilitiesPanel],
      providers: [...testProviders(), screenWidth(390)],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BotAbilitiesPanel);
    await fixture.whenStable();
    backend.expectOne('/api/teacher/notifications/bot').flush(abilities());
    await fixture.whenStable();

    buttonByText(hostElement(fixture), 'Что умеет бот').click();
    await fixture.whenStable();

    expect(readableText(document.body)).toContain('Вам Сегодня');
    expect(hostElement(fixture).querySelector('#tb-bot-abilities')).toBeNull();
  });
});
