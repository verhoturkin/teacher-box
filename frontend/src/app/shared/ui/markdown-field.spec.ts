import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MarkdownField, MarkdownMode } from './markdown-field';

@Component({
  imports: [MarkdownField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-markdown-field
    fieldId="text"
    label="Текст"
    [hint]="hint"
    [control]="text"
    [mode]="mode"
  />`,
})
class Host {
  hint: string | null = 'Первая строка станет названием';
  readonly text = new FormControl('**Жирный**', {
    nonNullable: true,
    validators: [Validators.maxLength(5)],
  });
  readonly mode = new FormControl<MarkdownMode>('edit', { nonNullable: true });
}

describe('MarkdownField', () => {
  it('switches between the text and the preview, keeping the text area height', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = hostElement(fixture);
    expect(host.querySelector('label')?.getAttribute('for')).toBe('text');
    expect(host.querySelector('textarea')?.id).toBe('text');
    expect(host.textContent).toContain('Первая строка станет названием. Поддерживается Markdown');

    fixture.componentInstance.text.markAsTouched();
    fixture.componentInstance.text.setValue('**Новый**');
    await fixture.whenStable();
    expect(host.textContent).toContain('Не длиннее 5 символов');

    fixture.componentInstance.mode.setValue('preview');
    await fixture.whenStable();
    expect(host.querySelector('textarea')).toBeNull();
    expect(host.querySelector('.tb-preview strong')?.textContent).toBe('Новый');
    fixture.componentInstance.text.setValue('*Курсив*');
    await fixture.whenStable();
    expect(host.querySelector('.tb-preview em')?.textContent).toBe('Курсив');

    fixture.componentInstance.mode.setValue('edit');
    await fixture.whenStable();
    expect(host.querySelector('textarea')?.value).toBe('*Курсив*');
  });

  it('has the Markdown hint alone without a hint of its own', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hint = null;
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('.tb-hint')?.textContent).toBe(
      'Поддерживается Markdown: **жирный**, *курсив*, списки, ссылки.',
    );
  });
});
