import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { testProviders } from '@testing/setup';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { PageHeader } from './page-header';

@Component({
  imports: [PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Задание" back="/teacher/homework" backLabel="Все задания">
      <span help class="probe-help">?</span>
      <span meta>Срок: 02.10</span>
      <button type="button">Изменить</button>
    </tb-page-header>
  `,
})
class NestedPage {}

@Component({
  imports: [PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-page-header title="Ученики" />`,
})
class SectionPage {}

describe('PageHeader', () => {
  it('shows «back» as an icon named after its target, the title, help, details and actions', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const fixture = TestBed.createComponent(NestedPage);
    await fixture.whenStable();
    const host = hostElement(fixture);

    const back = requireElement(host, '.tb-page-header__back', HTMLAnchorElement);
    expect(back.getAttribute('aria-label')).toBe('Все задания');
    expect(back.getAttribute('href')).toBe('/teacher/homework');
    expect(back.textContent.trim()).toBe('');
    expect(requireElement(host, 'h1.tb-page-title', HTMLElement).textContent.trim()).toBe(
      'Задание',
    );
    expect(host.querySelector('.tb-page-heading .probe-help')).not.toBeNull();
    expect(readableText(requireElement(host, '.tb-page-header__text', HTMLElement))).toContain(
      'Срок: 02.10',
    );
    expect(requireElement(host, '.tb-actions button', HTMLButtonElement).textContent.trim()).toBe(
      'Изменить',
    );
  });

  it('has no «back» on a section page', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const fixture = TestBed.createComponent(SectionPage);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(host.querySelector('.tb-page-header__back')).toBeNull();
    expect(readableText(host)).toContain('Ученики');
  });
});
