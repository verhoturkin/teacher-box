import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { bodyText, buttonByText, hostElement } from '@testing/dom';
import { linkCode } from '@testing/notification-fixtures';
import { testProviders } from '@testing/setup';
import { LinkCodeView } from './link-code-view';

describe('LinkCodeView', () => {
  let fixture: ComponentFixture<LinkCodeView>;
  const writeText = vi.fn(() => Promise.resolve());

  function render(): void {
    fixture = TestBed.createComponent(LinkCodeView);
    fixture.componentRef.setInput('code', linkCode());
    fixture.detectChanges();
  }

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    TestBed.configureTestingModule({ providers: testProviders() });
  });

  it('shows the code, the wait for the connection and a link that opens the bot', () => {
    render();

    expect(bodyText()).toContain('ABCD-2345');
    expect(bodyText()).toContain('Ждём подключения');
    expect(hostElement(fixture).querySelector('a[href^="https://t.me/"]')).not.toBeNull();
  });

  it('copies the code', async () => {
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    render();

    buttonByText(hostElement(fixture), 'Скопировать код').click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith('ABCD-2345');
    expect(success).toHaveBeenCalledWith('Скопировано');
  });
});
