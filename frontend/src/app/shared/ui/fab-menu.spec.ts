import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { FabMenu, FabMenuItem } from './fab-menu';

describe('FabMenu', () => {
  let fixture: ComponentFixture<FabMenu>;
  let host: HTMLElement;

  const items: FabMenuItem[] = [
    { label: 'Занятие', icon: 'tb-i-calendar_add_on', link: '/teacher/schedule' },
    {
      label: 'Оплата',
      icon: 'tb-i-account_balance_wallet',
      link: '/teacher/billing',
      queryParams: { create: 'payment' },
    },
  ];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [FabMenu], providers: testProviders() });
    fixture = TestBed.createComponent(FabMenu);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('label', 'Быстрые действия');
    host = hostElement(fixture);
    document.body.appendChild(host);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function button(): HTMLButtonElement {
    const element = host.querySelector<HTMLButtonElement>('.tb-fab-menu__button');
    if (element === null) {
      throw new Error('no FAB');
    }
    return element;
  }

  async function toggle(): Promise<void> {
    button().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('opens the actions over the FAB, which becomes «Закрыть», and focuses the first one', async () => {
    expect(button().getAttribute('aria-label')).toBe('Быстрые действия');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();

    await toggle();

    const links = Array.from(host.querySelectorAll('a')).map((link) => [
      link.textContent.trim(),
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Занятие', '/teacher/schedule'],
      ['Оплата', '/teacher/billing?create=payment'],
    ]);
    expect(button().getAttribute('aria-label')).toBe('Закрыть');
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent.trim()).toBe('Занятие');

    await toggle();
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('closes on Esc with the focus on the FAB, and on a tap outside', async () => {
    await toggle();
    host
      .querySelector('a')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();
    expect(document.activeElement).toBe(button());

    await toggle();
    host.click();
    fixture.detectChanges();
    expect(host.querySelector('.tb-fab-menu__list')).not.toBeNull();
    document.body.click();
    fixture.detectChanges();
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();
  });

  it('closes when an action is chosen', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await toggle();

    host.querySelectorAll('a')[1]?.click();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalled();
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();
  });
});
