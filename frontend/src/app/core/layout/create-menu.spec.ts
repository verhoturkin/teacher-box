import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { hostElement, requireElement } from '@testing/dom';
import { testProvidersWithRouter } from '@testing/setup';
import { CREATE_ACTIONS, CreateMenu, createItems } from './create-menu';

describe('createItems', () => {
  it('puts the current section’s item first, the others in their order', () => {
    const labels = (url: string): string[] => createItems(url).map((item) => item.label);
    const usual = ['Занятие', 'Задание', 'Оплата', 'Ученик', 'Доска', 'Сообщение'];

    expect(labels('/teacher')).toEqual(usual);
    expect(labels('/teacher/settings')).toEqual(usual);
    expect(labels('/teacher/billing?student=s-1')).toEqual([
      'Оплата',
      'Занятие',
      'Задание',
      'Ученик',
      'Доска',
      'Сообщение',
    ]);
    expect(labels('/teacher/homework/a-1/edit')[0]).toBe('Задание');
    expect(labels('/teacher/notifications#messages')[0]).toBe('Сообщение');
    // a section whose link only starts the same way is another one
    expect(labels('/teacher/boardsmith')).toEqual(usual);
  });

  it('leads each item to its section with ?create=<kind> (M3: up to six)', () => {
    expect(CREATE_ACTIONS.length).toBeLessThanOrEqual(6);
    expect(createItems('/teacher').map((item) => [item.link, item.queryParams])).toEqual([
      ['/teacher/schedule', { create: 'lesson' }],
      ['/teacher/homework', { create: 'assignment' }],
      ['/teacher/billing', { create: 'payment' }],
      ['/teacher/students', { create: 'student' }],
      ['/teacher/boards', { create: 'board' }],
      ['/teacher/notifications', { create: 'message' }],
    ]);
  });
});

describe('CreateMenu', () => {
  let fixture: ComponentFixture<CreateMenu>;
  let host: HTMLElement;

  async function render(extended: boolean, url: string): Promise<void> {
    TestBed.configureTestingModule({
      imports: [CreateMenu],
      providers: testProvidersWithRouter(provideRouter([{ path: '**', children: [] }])),
    });
    await TestBed.inject(Router).navigateByUrl(url);
    fixture = TestBed.createComponent(CreateMenu);
    fixture.componentRef.setInput('extended', extended);
    host = hostElement(fixture);
    document.body.appendChild(host);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture.destroy();
  });

  function fab(): HTMLButtonElement {
    return requireElement(host, '.tb-fab-menu__button', HTMLButtonElement);
  }

  function links(): string[] {
    return Array.from(host.querySelectorAll('a')).map((link) => link.textContent.trim());
  }

  async function toggle(): Promise<void> {
    fab().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('is the small extended FAB «Создать» in the expanded rail', async () => {
    await render(true, '/teacher');

    expect(host.querySelector('tb-fab-menu')?.classList).toContain('tb-fab-menu--extended');
    expect(fab().textContent.trim()).toBe('Создать');
    expect(fab().getAttribute('aria-expanded')).toBe('false');
  });

  it('is the FAB in the collapsed rail; opens the current section first and follows the page', async () => {
    await render(false, '/teacher/students/s-1');

    expect(host.classList).toContain('tb-create-menu--rail');
    expect(host.querySelector('tb-fab-menu')?.classList).not.toContain('tb-fab-menu--extended');
    expect(fab().getAttribute('aria-label')).toBe('Создать');

    await toggle();
    expect(links()[0]).toBe('Ученик');
    expect(document.activeElement?.textContent.trim()).toBe('Ученик');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/teacher/students?create=student');

    // keyboard: ↓ to the next item, Esc closes with the focus back on the FAB
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(document.activeElement?.textContent.trim()).toBe('Занятие');
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(host.querySelector('a')).toBeNull();
    expect(document.activeElement).toBe(fab());

    await TestBed.inject(Router).navigateByUrl('/teacher/boards');
    await toggle();
    expect(links()[0]).toBe('Доска');
  });

  it('closes when an item is chosen and leads to the section', async () => {
    await render(false, '/teacher');
    await toggle();

    const payment = Array.from(host.querySelectorAll('a')).find(
      (link) => link.textContent.trim() === 'Оплата',
    );
    payment?.click();
    await fixture.whenStable();

    expect(host.querySelector('a')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/teacher/billing?create=payment');
  });
});
