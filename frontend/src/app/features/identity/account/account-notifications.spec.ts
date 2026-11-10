import { HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Role } from '@core/auth/auth.models';
import { hostElement } from '@testing/dom';
import { phoneScreen, screenWidth, testProviders } from '@testing/setup';
import { AccountNotifications } from './account-notifications';
import { AccountPanel } from './account-panel';

@Component({
  imports: [AccountNotifications, AccountPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-account-panel>
      <ng-template tbAccountNotifications let-teacher>
        <p class="slot">{{ teacher ? 'teacher' : 'student' }}</p>
      </ng-template>
    </tb-account-panel>
  `,
})
class Host {}

describe('AccountPanel with projected «Уведомления»', () => {
  async function render(role: Role, ...screen: Parameters<typeof testProviders>) {
    TestBed.configureTestingModule({ imports: [Host], providers: testProviders(...screen) });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/me').flush({
      id: '1',
      role,
      displayName: 'Анна',
      profileName: 'Анна',
      avatar: null,
      login: 'anna',
      email: null,
      phone: null,
      passwordChangeRequired: false,
      language: 'ru',
    });
    await fixture.whenStable();
    return hostElement(fixture).querySelector('.slot')?.textContent ?? null;
  }

  it('shows them to the teacher and tells the slot so', async () => {
    expect(await render('TEACHER')).toBe('teacher');
  });

  it('shows them to a student on a phone and a tablet', async () => {
    expect(await render('STUDENT', phoneScreen())).toBe('student');
    TestBed.resetTestingModule();
    expect(await render('STUDENT', screenWidth(700))).toBe('student');
  });

  it('leaves them out for the administrator', async () => {
    expect(await render('ADMIN')).toBeNull();
  });
});
