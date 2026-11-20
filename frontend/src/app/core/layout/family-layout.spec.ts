import { HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Family } from '@core/family/family';
import { authResponse } from '@testing/auth';
import { bodyText, hostElement, menuItemByText } from '@testing/dom';
import { CHILD_ID, SECOND_CHILD_ID, familyChild } from '@testing/family-fixtures';
import { screenWidth, testProvidersWithRouter } from '@testing/setup';
import { childAddress } from './child-switcher';
import { FamilyLayout, familyMenu } from './family-layout';

let created = 0;

@Component({ template: 'page', changeDetection: ChangeDetectionStrategy.OnPush })
class Page {
  constructor() {
    created++;
  }
}

describe('FamilyLayout', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let router: Router;

  async function render(width: number, children = [familyChild()]): Promise<HTMLElement> {
    created = 0;
    TestBed.configureTestingModule({
      providers: testProvidersWithRouter(
        provideRouter([
          {
            path: 'family/:studentId',
            component: FamilyLayout,
            children: [{ path: '**', component: Page }],
          },
        ]),
        screenWidth(width),
      ),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('GUARDIAN'));
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    const family = TestBed.inject(Family);
    family.load().subscribe();
    backend.expectOne('/api/guardian/children').flush(children);
    family.current.set(CHILD_ID);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/family/${CHILD_ID}/schedule`);
    await harness.fixture.whenStable();
    return hostElement(harness.fixture);
  }

  afterEach(() => {
    // the bell asks for the parent's unread count (454.3)
    for (const request of backend.match('/api/me/notifications/unread-count')) {
      if (!request.cancelled) request.flush({ count: 0 });
    }
    backend.verify();
  });

  it.each([
    [599, 'nav.tb-bottom-nav a'],
    [1600, 'tb-side-nav ul:not(.tb-side-nav__footer) a'],
  ])('at %i px has the four sections of the child and the bell', async (width, links) => {
    const host = await render(width);

    const items = Array.from(host.querySelectorAll(links));
    expect(items.map((a) => a.querySelector('[class$="__label"]')?.textContent.trim())).toEqual([
      'Главная',
      'Расписание',
      'Задания',
      'Оплаты',
    ]);
    expect(items.map((a) => a.getAttribute('href'))).toEqual([
      `/family/${CHILD_ID}`,
      `/family/${CHILD_ID}/schedule`,
      `/family/${CHILD_ID}/homework`,
      `/family/${CHILD_ID}/billing`,
    ]);
    expect(host.querySelector('tb-notification-bell')).not.toBeNull();
    expect(host.querySelector('tb-nav-badge')).toBeNull();
  });

  it('has no switcher for one child', async () => {
    const host = await render(1600);
    expect(host.querySelector('.tb-child-chip')).toBeNull();
  });

  it('switches between the children with chips and builds the pages again', async () => {
    const host = await render(1600, [
      familyChild(),
      familyChild({ id: SECOND_CHILD_ID, displayName: 'Маша Смирнова', avatar: '/a/m.png' }),
    ]);

    const chips = Array.from(host.querySelectorAll<HTMLAnchorElement>('a.tb-child-chip'));
    expect(chips.map((chip) => chip.textContent.trim())).toEqual(['ПС Петя', 'Маша']);
    expect(chips.map((chip) => chip.getAttribute('aria-current'))).toEqual(['page', null]);
    expect(chips[1]?.getAttribute('href')).toBe(`/family/${SECOND_CHILD_ID}/schedule`);
    expect(chips[0]?.querySelector('tb-avatar')?.getAttribute('data-tb-label')).toBe('red');
    expect(chips[1]?.querySelector('tb-avatar')?.getAttribute('data-tb-label')).toBe('lime');
    expect(host.querySelector('.tb-child-switcher__set')?.getAttribute('aria-label')).toBe('Дети');
    const pages = created;

    TestBed.inject(Family).current.set(SECOND_CHILD_ID);
    await harness.fixture.whenStable();
    // the frame follows the route, not the guard's choice: nothing is built before the navigation
    expect(created).toBe(pages);
    await harness.navigateByUrl(`/family/${SECOND_CHILD_ID}/schedule`);
    await harness.fixture.whenStable();
    expect(created).toBeGreaterThan(pages);
    expect(host.querySelector('a.tb-child-chip--selected')?.textContent.trim()).toBe('Маша');
  });

  it('on a phone offers the other children in a menu of one chip', async () => {
    const host = await render(390, [
      familyChild(),
      familyChild({ id: SECOND_CHILD_ID, displayName: 'Маша Смирнова' }),
    ]);

    const chip = host.querySelector<HTMLButtonElement>('button.tb-child-chip');
    expect(chip?.getAttribute('aria-label')).toBe('Ребёнок: Петя Смирнов. Выбрать другого');
    chip?.click();
    await harness.fixture.whenStable();
    expect(bodyText()).toContain('Маша Смирнова');
    menuItemByText('Маша Смирнова').click();
    await harness.fixture.whenStable();
    expect(router.url).toBe(`/family/${SECOND_CHILD_ID}/schedule`);
  });
});

describe('familyMenu and childAddress', () => {
  it('lead into the child of the address', () => {
    expect(familyMenu('c').map((item) => String(item.routerLink))).toEqual([
      '/family/c',
      '/family/c/schedule',
      '/family/c/homework',
      '/family/c/billing',
    ]);
    expect(childAddress('/family/a/homework/t-1?x=1', 'b')).toBe('/family/b/homework');
    expect(childAddress('/family/a', 'b')).toBe('/family/b');
    expect(childAddress('/family/a/', 'b')).toBe('/family/b');
    expect(childAddress('/cabinet/schedule', 'b')).toBe('/family/b');
  });
});
