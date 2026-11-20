import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { buttonByText, hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { of } from 'rxjs';
import { NoChildrenPage } from './no-children';

describe('NoChildrenPage', () => {
  it('says there is no student and signs out', async () => {
    const logout = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      imports: [NoChildrenPage],
      providers: [...testProviders(), { provide: AuthService, useValue: { logout } }],
    });
    const fixture = TestBed.createComponent(NoChildrenPage);
    await fixture.whenStable();
    const host = hostElement(fixture);

    expect(readableText(host)).toContain('Нет учеников');
    buttonByText(host, 'Выйти').click();
    expect(logout).toHaveBeenCalled();
  });
});
