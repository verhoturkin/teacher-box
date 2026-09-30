import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { MarkdownView, renderMarkdown } from './markdown-view';

describe('MarkdownView', () => {
  it('renders markdown with line breaks', () => {
    expect(renderMarkdown('**жирный**\nстрока')).toContain('<strong>жирный</strong><br>строка');
  });

  it('moves the headings down, not beyond h6', () => {
    expect(renderMarkdown('## Раздел', 1)).toContain('<h3');
    expect(renderMarkdown('## Раздел', 1)).toContain('</h3>');
    expect(renderMarkdown('##### Мелко', 3)).toContain('<h6');
  });

  it('shows sanitized html', async () => {
    TestBed.configureTestingModule({ imports: [MarkdownView] });
    const fixture = TestBed.createComponent(MarkdownView);
    fixture.componentRef.setInput(
      'text',
      '# Заголовок\n\n<script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    );
    await fixture.whenStable();

    const host = hostElement(fixture);
    // inside a section (h2) the heading of the text is h3 (ADR-0024)
    expect(host.querySelector('h3')?.textContent).toBe('Заголовок');
    expect(host.querySelector('h1')).toBeNull();
    expect(host.querySelector('script')).toBeNull();
    // Angular neutralizes dangerous URLs by prefixing them with "unsafe:".
    expect(host.querySelector('a')?.getAttribute('href')).toMatch(/^unsafe:/);
  });

  it('renders nothing for empty text', async () => {
    TestBed.configureTestingModule({ imports: [MarkdownView] });
    const fixture = TestBed.createComponent(MarkdownView);
    await fixture.whenStable();

    expect(hostElement(fixture).textContent.trim()).toBe('');
  });
});
