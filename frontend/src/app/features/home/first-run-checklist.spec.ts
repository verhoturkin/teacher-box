import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { CHECKLIST_DISMISSED_KEY, FirstRunChecklist, SetupProgress } from './first-run-checklist';

describe('FirstRunChecklist', () => {
  let fixture: ComponentFixture<FirstRunChecklist>;

  const fresh: SetupProgress = { hasStudents: true, priceSet: true, messengerConfigured: false, hasLessons: false };

  async function render(progress: SetupProgress): Promise<void> {
    TestBed.configureTestingModule({ imports: [FirstRunChecklist], providers: [provideRouter([]), providePrimeNG()] });
    fixture = TestBed.createComponent(FirstRunChecklist);
    fixture.componentRef.setInput('progress', progress);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return readableText(hostElement(fixture));
  }

  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('lists the steps with links to the ones left', async () => {
    await render(fresh);

    expect(text()).toContain('С чего начать');
    expect(text()).toContain('Сделано 2 из 4');
    const links = Array.from(hostElement(fixture).querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/teacher/notifications?tab=messengers', '/teacher/schedule']);
  });

  it('waits until everything is known and hides when done', async () => {
    await render({ ...fresh, hasLessons: null });
    expect(text()).toBe('');

    fixture.componentRef.setInput('progress', {
      hasStudents: true,
      priceSet: true,
      messengerConfigured: true,
      hasLessons: true,
    });
    fixture.detectChanges();
    expect(text()).toBe('');
  });

  it('can be hidden for good', async () => {
    await render(fresh);

    buttonByText(hostElement(fixture), 'Скрыть').click();
    fixture.detectChanges();

    expect(text()).toBe('');
    expect(localStorage.getItem(CHECKLIST_DISMISSED_KEY)).toBe('1');
    fixture.destroy();
    TestBed.resetTestingModule();
    await render(fresh);
    expect(text()).toBe('');
  });

  it('works without browser storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await render(fresh);

    buttonByText(hostElement(fixture), 'Скрыть').click();
    fixture.detectChanges();

    expect(text()).toBe('');
  });
});
