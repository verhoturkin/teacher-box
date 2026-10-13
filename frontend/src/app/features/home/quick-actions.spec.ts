import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { phoneScreen, testProviders } from '@testing/setup';
import { QuickActions } from './quick-actions';

describe('QuickActions', () => {
  it('links to the forms of a lesson, a payment, a student and an assignment', async () => {
    TestBed.configureTestingModule({ imports: [QuickActions], providers: testProviders() });
    const fixture = TestBed.createComponent(QuickActions);
    await fixture.whenStable();

    const links = Array.from(hostElement(fixture).querySelectorAll('a')).map((link) => [
      link.textContent.trim(),
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Занятие', '/teacher/schedule?create=lesson'],
      ['Оплата', '/teacher/billing?create=payment'],
      ['Ученик', '/teacher/students?create=student'],
      ['Задание', '/teacher/homework?create=assignment'],
    ]);
  });

  it('is the FAB menu on a phone', async () => {
    TestBed.configureTestingModule({
      imports: [QuickActions],
      providers: testProviders(phoneScreen()),
    });
    const fixture = TestBed.createComponent(QuickActions);
    await fixture.whenStable();
    const host = hostElement(fixture);
    expect(host.querySelector('.tb-quick-actions')).toBeNull();

    host.querySelector<HTMLButtonElement>('tb-fab-menu button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      Array.from(host.querySelectorAll('tb-fab-menu a')).map((link) => link.textContent.trim()),
    ).toEqual(['Занятие', 'Оплата', 'Ученик', 'Задание']);
  });
});
