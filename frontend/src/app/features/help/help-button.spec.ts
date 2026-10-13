import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, hostElement } from '@testing/dom';
import { HelpButton } from './help-button';

describe('HelpButton', () => {
  let fixture: ComponentFixture<HelpButton>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HelpButton],
      providers: [provideRouter([]), providePrimeNG()],
    });
    fixture = TestBed.createComponent(HelpButton);
    fixture.componentRef.setInput('topic', 'teacher/groups');
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('opens the article in a modal side sheet', async () => {
    buttonByText(hostElement(fixture), 'Справка: Группы').click();
    await fixture.componentInstance.open();
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(true);
    expect(bodyText()).toContain('Группа — это ученики, которые занимаются вместе.');
    const all = Array.from(document.body.querySelectorAll('a')).find((link) =>
      link.textContent.includes('Вся справка'),
    );
    expect(all?.getAttribute('href')).toBe('/teacher/help/groups');
  });

  it('opens a linked article in the sheet and goes back to the first one', async () => {
    fixture.componentRef.setInput('topic', 'teacher/billing');
    fixture.componentRef.setInput('label', 'Подробнее');
    await fixture.whenStable();
    expect(hostElement(fixture).textContent).toContain('Подробнее');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.componentInstance.open();
    await fixture.whenStable();
    // the sheet is modal (ADR-0024), without «←» on the first article
    expect(document.body.querySelector('.p-drawer-mask')).not.toBeNull();
    expect(document.body.querySelector('.tb-side-sheet__head button')).toBeNull();

    document.body
      .querySelector<HTMLAnchorElement>('.tb-help-article a[href="/teacher/help/bot"]')
      ?.click();
    await vi.waitFor(() => {
      expect(title()).toBe('Что умеет бот');
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    const back = document.body.querySelector<HTMLButtonElement>('.tb-side-sheet__head button');
    expect(back?.getAttribute('aria-label')).toBe('Назад');
    back?.click();
    await fixture.whenStable();
    expect(title()).toBe('Оплаты');
    expect(document.body.querySelector('.tb-side-sheet__head button')).toBeNull();
  });

  function title(): string | undefined {
    fixture.detectChanges();
    return document.body.querySelector('.tb-side-sheet .p-drawer-title')?.textContent.trim();
  }

  it('closes when the whole help is opened', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.componentInstance.open();
    await fixture.whenStable();
    const all = Array.from(document.body.querySelectorAll('a')).find((link) =>
      link.textContent.includes('Вся справка'),
    );
    all?.addEventListener('click', (event) => {
      event.preventDefault();
    });

    all?.click();

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(navigate).toHaveBeenCalled();
  });
});
