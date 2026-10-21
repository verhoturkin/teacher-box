import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { hostElement } from '@testing/dom';
import { screenWidth, testProvidersWithRouter } from '@testing/setup';
import { StudentLayout } from './student-layout';

describe('StudentLayout', () => {
  let fixture: ComponentFixture<StudentLayout>;
  let backend: HttpTestingController;

  async function render(width: number, open = 3): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [StudentLayout],
      providers: testProvidersWithRouter(
        provideRouter([{ path: '**', children: [] }]),
        screenWidth(width),
      ),
    });
    TestBed.inject(AuthService).acceptSession(authResponse('STUDENT'));
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentLayout);
    await fixture.whenStable();
    backend.expectOne('/api/me/homework/summary').flush({ open, overdue: 0, upcoming: [] });
    await fixture.whenStable();
    return hostElement(fixture);
  }

  afterEach(() => {
    fixture.destroy();
  });

  it.each([
    [599, 'bar'],
    [600, 'rail'],
    [839, 'rail'],
    [840, 'rail'],
    [1199, 'rail'],
    [1200, 'rail'],
    [1599, 'rail'],
    [1600, 'expanded rail'],
  ])('at %i px shows the %s with the five sections and no «Создать»', async (width, navigation) => {
    const host = await render(width);

    const links = host.querySelectorAll(
      navigation === 'bar' ? 'nav.tb-bottom-nav a' : 'tb-side-nav ul:not(.tb-side-nav__footer) a',
    );
    expect(
      Array.from(links).map((a) => a.querySelector('[class$="__label"]')?.textContent.trim()),
    ).toEqual(['Главная', 'Расписание', 'Задания', 'Материалы', 'Оплаты']);
    expect(host.querySelector('tb-create-menu')).toBeNull();
    expect(host.textContent).not.toContain('Ещё');
  });

  it.each([599, 600, 1600])('shows the open tasks on «Задания» at %i px', async (width) => {
    const host = await render(width);

    const badges = host.querySelectorAll('tb-nav-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.textContent.trim()).toBe('3');
    expect(host.textContent).toContain('Заданий к сдаче: 3');
  });

  it('hides the badge when nothing is open and counts again after a navigation', async () => {
    const host = await render(1600, 0);
    expect(host.querySelector('tb-nav-badge')).toBeNull();
    expect(host.textContent).not.toContain('Заданий к сдаче');

    await TestBed.inject(Router).navigateByUrl('/cabinet/homework');
    await fixture.whenStable();
    backend.expectOne('/api/me/homework/summary').flush({ open: 1200, overdue: 0, upcoming: [] });
    await fixture.whenStable();
    expect(host.querySelector('tb-nav-badge')?.textContent.trim()).toBe('999+');
  });

  it('keeps the last count when the request fails', async () => {
    const host = await render(1600);

    await TestBed.inject(Router).navigateByUrl('/cabinet/schedule');
    await fixture.whenStable();
    backend
      .expectOne('/api/me/homework/summary')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(host.querySelector('tb-nav-badge')?.textContent.trim()).toBe('3');
  });
});
