import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { Portal } from '@core/portal/portal';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { StudentWelcomeCard, WELCOME_DISMISSED_KEY } from './student-welcome-card';

describe('StudentWelcomeCard', () => {
  let fixture: ComponentFixture<StudentWelcomeCard>;

  async function render(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [StudentWelcomeCard],
      providers: [provideRouter([]), providePrimeNG()],
    });
    TestBed.inject(Portal).set({ name: 'Английский с Марией', address: null });
    fixture = TestBed.createComponent(StudentWelcomeCard);
    await fixture.whenStable();
  }

  afterEach(() => {
    localStorage.removeItem(WELCOME_DISMISSED_KEY);
    fixture.destroy();
  });

  it('shows where things are until the student hides it', async () => {
    await render();
    const text = readableText(hostElement(fixture));
    expect(text).toContain('Добро пожаловать в «Английский с Марией»!');
    expect(text).toContain('Расписание — ваши занятия');

    buttonByText(hostElement(fixture), 'Понятно').click();
    await fixture.whenStable();

    expect(hostElement(fixture).textContent.trim()).toBe('');
    expect(localStorage.getItem(WELCOME_DISMISSED_KEY)).toBe('1');
  });

  it('stays hidden once hidden', async () => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
    await render();

    expect(hostElement(fixture).textContent.trim()).toBe('');
  });

  it('works without browser storage', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await render();
    expect(readableText(hostElement(fixture))).toContain('Добро пожаловать');

    fixture.componentInstance.dismiss();
    await fixture.whenStable();

    expect(hostElement(fixture).textContent.trim()).toBe('');
    get.mockRestore();
    set.mockRestore();
  });
});
