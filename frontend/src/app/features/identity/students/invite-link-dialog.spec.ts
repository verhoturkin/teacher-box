import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import { Dialog } from 'primeng/dialog';
import { Portal } from '@core/portal/portal';
import { bodyText, buttonByText, requireElement } from '@testing/dom';
import { InviteLinkDialog } from './invite-link-dialog';
import { portalInfo } from '@testing/portal-fixtures';

describe('InviteLinkDialog', () => {
  let fixture: ComponentFixture<InviteLinkDialog>;
  let clipboard: Clipboard;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [InviteLinkDialog], providers: [providePrimeNG()] });
    clipboard = TestBed.inject(Clipboard);
    fixture = TestBed.createComponent(InviteLinkDialog);
    fixture.componentRef.setInput('studentName', 'Мария');
    fixture.componentRef.setInput('invite', {
      token: 'secret-token',
      purpose: 'ACTIVATION',
      expiresAt: '2026-10-01T10:00:00Z',
    });
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('shows the invitation link', () => {
    const input = requireElement(document.body, '#invite-link', HTMLInputElement);

    expect(input.value).toBe(`${window.location.origin}/invite/secret-token`);
    expect(bodyText()).toContain('Ссылка для ученика: Мария');
    expect(bodyText()).toContain('придумает логин и пароль');
  });

  it('copies the link', async () => {
    vi.spyOn(clipboard, 'copy').mockReturnValue(true);

    buttonByText(document.body, 'Копировать ссылку').click();
    await fixture.whenStable();

    expect(clipboard.copy).toHaveBeenCalledWith(`${window.location.origin}/invite/secret-token`);
    expect(bodyText()).toContain('Скопировано');
  });

  it('closes with «Закрыть» and focuses the title when shown', async () => {
    const dialog = fixture.debugElement.query(By.directive(Dialog)).injector.get(Dialog);
    dialog.onShow.emit({});
    expect(document.activeElement?.textContent).toContain('Ссылка для ученика: Мария');

    buttonByText(document.body, 'Закрыть').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('starts the link with the portal address', async () => {
    TestBed.inject(Portal).set(
      portalInfo({ name: 'Школа', address: 'https://school.example.com' }),
    );
    await fixture.whenStable();

    const input = requireElement(document.body, '#invite-link', HTMLInputElement);
    expect(input.value).toBe('https://school.example.com/invite/secret-token');
  });

  it('explains password reset links', async () => {
    fixture.componentRef.setInput('invite', {
      token: 'reset',
      purpose: 'PASSWORD_RESET',
      expiresAt: '2026-10-01T10:00:00Z',
    });
    await fixture.whenStable();

    expect(bodyText()).toContain('задаст новый пароль');
  });

  it('renders nothing without an invitation', async () => {
    fixture.componentRef.setInput('invite', null);
    await fixture.whenStable();

    expect(document.body.querySelector('#invite-link')).toBeNull();
  });
});
