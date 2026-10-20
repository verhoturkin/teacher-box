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

  it('runs an action over the page and gives the focus back to the FAB', async () => {
    const run = vi.fn();
    fixture.componentRef.setInput('items', [
      ...items,
      { label: 'Сообщение', icon: 'tb-i-send', run },
    ]);
    await toggle();

    const action = host.querySelector<HTMLButtonElement>('button.tb-fab-menu__item');
    expect(action?.textContent.trim()).toBe('Сообщение');
    action?.click();
    fixture.detectChanges();

    expect(run).toHaveBeenCalledOnce();
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('moves between the actions with the arrows, Home and End', async () => {
    await toggle();
    const links = Array.from(host.querySelectorAll('a'));
    const press = (key: string): void => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    };

    press('ArrowDown');
    expect(document.activeElement).toBe(links[1]);
    press('ArrowDown');
    expect(document.activeElement).toBe(links[0]);
    press('ArrowUp');
    expect(document.activeElement).toBe(links[1]);
    press('Home');
    expect(document.activeElement).toBe(links[0]);
    press('ArrowUp');
    expect(document.activeElement).toBe(links[1]);
    press('End');
    expect(document.activeElement).toBe(links[1]);
    press('Tab');
    expect(document.activeElement).toBe(links[1]);
  });

  it('closes when the focus leaves it, not when it moves inside', async () => {
    await toggle();
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    host
      .querySelector('a')
      ?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: button() }));
    fixture.detectChanges();
    expect(host.querySelector('.tb-fab-menu__list')).not.toBeNull();

    host
      .querySelector('a')
      ?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    fixture.detectChanges();
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();
    outside.remove();
  });

  it('in the rail opens the list under the FAB; the extended FAB keeps its label as the name', async () => {
    fixture.componentRef.setInput('variant', 'extended');
    await fixture.whenStable();
    vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 12, y: 80, width: 120, height: 56 }),
    );
    expect(host.classList).toContain('tb-fab-menu--rail');
    expect(button().hasAttribute('aria-label')).toBe(false);
    expect(button().textContent.trim()).toBe('Быстрые действия');

    await toggle();
    const list = host.querySelector<HTMLElement>('.tb-fab-menu__list');
    expect(list?.style.top).toBe('144px');
    expect(list?.style.left).toBe('12px');
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent.trim()).toBe('Занятие');

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(host.querySelector('.tb-fab-menu__list')).toBeNull();

    fixture.componentRef.setInput('variant', 'rail');
    await fixture.whenStable();
    expect(host.classList).not.toContain('tb-fab-menu--extended');
    expect(button().getAttribute('aria-label')).toBe('Быстрые действия');
  });
});
