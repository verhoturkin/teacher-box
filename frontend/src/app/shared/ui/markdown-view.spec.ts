import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { MarkdownView, renderMarkdown } from './markdown-view';

describe('MarkdownView', () => {
  it('renders markdown with line breaks', () => {
    expect(renderMarkdown('**жирный**\nстрока')).toContain('<strong>жирный</strong><br>строка');
  });

  it('shows sanitized html', async () => {
    TestBed.configureTestingModule({ imports: [MarkdownView] });
    const fixture = TestBed.createComponent(MarkdownView);
    fixture.componentRef.setInput('text', '# Заголовок\n\n<script>alert(1)</script><a href="javascript:alert(1)">x</a>');
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('h1')?.textContent).toBe('Заголовок');
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
