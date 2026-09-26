import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { AuthService } from '@core/auth/auth.service';
import { authResponse } from '@testing/auth';
import { bodyText, buttonByText, hostElement } from '@testing/dom';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    TestBed.inject(AuthService).acceptSession(authResponse('TEACHER'));
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('items', [{ label: 'Ученики', routerLink: '/teacher/students' }]);
    fixture.componentRef.setInput('homeLink', '/teacher');
    fixture.componentRef.setInput('areaTitle', 'Кабинет учителя');
    fixture.componentRef.setInput('userLinks', [{ label: 'Настройки', routerLink: '/teacher/settings' }]);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('shows navigation, area and the user', () => {
    const text = hostElement(fixture).textContent;
    expect(text).toContain('Teacher Box');
    expect(text).toContain('Ученики');
    expect(text).toContain('Кабинет учителя');
    expect(text).toContain('Анна Сергеевна');
  });

  it('signs out from the user menu', async () => {
    buttonByText(hostElement(fixture), 'Меню пользователя').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Настройки');
    expect(bodyText()).toContain('Мой аккаунт');

    const logout = Array.from(document.body.querySelectorAll('a')).find((element) =>
      element.textContent.includes('Выйти'),
    );
    if (logout === undefined) {
      throw new Error('Logout item not found');
    }
    logout.click();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush(null);

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });
});
