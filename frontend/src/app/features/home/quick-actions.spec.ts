import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
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
});
