import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { bodyText, hostElement, requireElement } from '@testing/dom';
import { linkCode } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { LinkCodeView } from './link-code-view';

describe('LinkCodeView', () => {
  let fixture: ComponentFixture<LinkCodeView>;

  function render(): void {
    fixture = TestBed.createComponent(LinkCodeView);
    fixture.componentRef.setInput('code', linkCode());
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
  });

  it('shows the code, the wait for the connection and a link that opens the bot', () => {
    render();

    expect(hostElement(fixture).querySelector('input')?.value).toBe('ABCD-2345');
    expect(bodyText()).toContain('Ждём подключения');
    expect(hostElement(fixture).querySelector('a[href^="https://t.me/"]')).not.toBeNull();
  });

  it('copies the code', async () => {
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    render();

    requireElement(
      hostElement(fixture),
      'button[aria-label="Скопировать код"]',
      HTMLButtonElement,
    ).click();
    await fixture.whenStable();

    expect(copy).toHaveBeenCalledWith('ABCD-2345');
    expect(success).toHaveBeenCalledWith('Скопировано');
  });
});
