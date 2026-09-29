import { ComponentFixture, TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, readableText, requireElement } from '@testing/dom';
import { phoneScreen, testProviders } from '@testing/setup';
import { ChangeKind } from '../data-access/schedule.models';
import { LessonActions } from './lesson-actions';

describe('LessonActions', () => {
  let fixture: ComponentFixture<LessonActions>;
  let asked: ChangeKind[];

  async function render(
    inputs: { joinUrl?: string | null; group?: boolean; requests?: boolean },
    phone = false,
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [LessonActions],
      providers: phone ? testProviders(phoneScreen()) : testProviders(),
    });
    fixture = TestBed.createComponent(LessonActions);
    fixture.componentRef.setInput('lessonName', 'вт, 29.09, 13:00–14:00');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    asked = [];
    fixture.componentInstance.ask.subscribe((kind) => asked.push(kind));
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the meeting and both requests on a computer', async () => {
    const host = await render({ joinUrl: 'https://telemost.yandex.ru/j/1' });

    expect(readableText(host)).toContain('Войти в урок');
    buttonByText(host, 'Перенести').click();
    buttonByText(host, 'Отменить').click();
    expect(asked).toEqual(['RESCHEDULE', 'CANCEL']);
    expect(host.querySelector('.pi-ellipsis-v')).toBeNull();
  });

  it('says «Не приду» for a group lesson and hides the requests when they are not allowed', async () => {
    const host = await render({ group: true });
    expect(readableText(host)).toContain('Не приду');

    fixture.componentRef.setInput('requests', false);
    await fixture.whenStable();
    expect(readableText(host)).not.toContain('Перенести');
  });

  it('keeps two buttons on a phone without a meeting', async () => {
    const host = await render({ joinUrl: null }, true);

    expect(buttonByText(host, 'Перенести')).toBeTruthy();
    expect(host.querySelector('.pi-ellipsis-v')).toBeNull();
  });

  it('folds the requests into a menu next to the meeting on a phone', async () => {
    const host = await render({ joinUrl: 'https://telemost.yandex.ru/j/1', group: true }, true);

    expect(readableText(host)).toContain('Войти в урок');
    expect(readableText(host)).not.toContain('Перенести');
    requireElement(
      host,
      'button[aria-label="Перенести или отменить: вт, 29.09, 13:00–14:00"]',
      HTMLButtonElement,
    ).click();
    await fixture.whenStable();

    const menu = requireElement(document.body, '.p-menu', HTMLElement);
    expect(readableText(menu)).toContain('Перенести');
    expect(readableText(menu)).toContain('Не приду');
    requireElement(menu, '.tb-menu-item--danger .p-menu-item-link', HTMLElement).click();
    requireElement(document.body, '.p-menu .p-menu-item-link', HTMLElement).click();
    expect(asked).toEqual(['CANCEL', 'RESCHEDULE']);
  });
});
