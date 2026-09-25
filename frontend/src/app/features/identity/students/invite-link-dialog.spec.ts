import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, requireElement } from '@testing/dom';
import { InviteLinkDialog } from './invite-link-dialog';

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
    const input = requireElement(document.body, 'input[aria-label="Ссылка-приглашение"]', HTMLInputElement);

    expect(input.value).toBe(`${window.location.origin}/invite/secret-token`);
    expect(bodyText()).toContain('Ссылка для ученика: Мария');
    expect(bodyText()).toContain('придумает логин и пароль');
  });

  it('copies the link', async () => {
    vi.spyOn(clipboard, 'copy').mockReturnValue(true);

    buttonByText(document.body, 'Копировать').click();
    await fixture.whenStable();

    expect(clipboard.copy).toHaveBeenCalledWith(`${window.location.origin}/invite/secret-token`);
    expect(bodyText()).toContain('Скопировано');
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

    expect(document.body.querySelector('input[aria-label="Ссылка-приглашение"]')).toBeNull();
  });
});
