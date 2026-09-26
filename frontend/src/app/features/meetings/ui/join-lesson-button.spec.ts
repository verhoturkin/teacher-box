import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { buttonByText, hostElement } from '@testing/dom';
import { MeetingPreferences } from '../telemost';
import { JoinLessonButton } from './join-lesson-button';

describe('JoinLessonButton', () => {
  let fixture: ComponentFixture<JoinLessonButton>;
  let navigation: { go: ReturnType<typeof vi.fn> };

  async function render(url: string, teacher: boolean, openInApp: boolean): Promise<void> {
    navigation = { go: vi.fn() };
    TestBed.configureTestingModule({
      imports: [JoinLessonButton],
      providers: [providePrimeNG(), { provide: ExternalNavigation, useValue: navigation }],
    });
    TestBed.inject(MeetingPreferences).openInApp.set(openInApp);
    fixture = TestBed.createComponent(JoinLessonButton);
    fixture.componentRef.setInput('url', url);
    fixture.componentRef.setInput('teacher', teacher);
    fixture.componentRef.setInput('label', 'Начать урок');
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  it('opens Telemost in the desktop application for the teacher', async () => {
    await render('https://telemost.yandex.ru/j/1', true, true);

    buttonByText(hostElement(fixture), 'Начать урок').click();

    expect(navigation.go).toHaveBeenCalledWith('telemost://https://telemost.yandex.ru/j/1');
    const browser = hostElement(fixture).querySelector('a');
    expect(browser?.textContent).toContain('в браузере');
    expect(browser?.getAttribute('href')).toBe('https://telemost.yandex.ru/j/1');
  });

  it('gives a plain link to other services', async () => {
    await render('https://zoom.us/j/1', true, true);
    expect(hostElement(fixture).querySelector('a')?.getAttribute('href')).toBe('https://zoom.us/j/1');
  });

  it('gives students a plain link', async () => {
    await render('https://telemost.yandex.ru/j/1', false, true);
    expect(hostElement(fixture).querySelector('a')?.textContent).toContain('Начать урок');
  });

  it('opens the browser when the application is not chosen on the device', async () => {
    await render('https://telemost.yandex.ru/j/1', true, false);
    expect(hostElement(fixture).querySelector('a')?.getAttribute('target')).toBe('_blank');
  });
});
