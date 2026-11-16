import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { hostElement, requireElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { CopyField } from './copy-field';

@Component({
  imports: [CopyField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-copy-field inputId="link" value="https://x.test/a" [mono]="true" />`,
})
class Host {}

describe('CopyField', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('shows the value in a read-only input', async () => {
    const host = await render();
    const input = requireElement(host, 'input', HTMLInputElement);
    expect(input.value).toBe('https://x.test/a');
    expect(input.readOnly).toBe(true);
    expect(input.id).toBe('link');
    expect(input.classList).toContain('tb-copy-field__mono');
  });

  it('copies the value and says so', async () => {
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    const host = await render();

    requireElement(host, 'button[aria-label="Копировать"]', HTMLButtonElement).click();

    expect(copy).toHaveBeenCalledWith('https://x.test/a');
    expect(success).toHaveBeenCalledWith('Скопировано');
  });

  it('stays silent when the copy is refused', async () => {
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(false);
    const success = vi.spyOn(TestBed.inject(Snackbar), 'success');
    const host = await render();

    requireElement(host, 'button[aria-label="Копировать"]', HTMLButtonElement).click();

    expect(success).not.toHaveBeenCalled();
  });
});
