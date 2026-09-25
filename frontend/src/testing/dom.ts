import { ComponentFixture } from '@angular/core/testing';

/** Typed access to the host element of a component fixture (`nativeElement` is typed as `any`). */
export function hostElement(fixture: ComponentFixture<unknown>): HTMLElement {
  const element: unknown = fixture.nativeElement;
  if (!(element instanceof HTMLElement)) {
    throw new Error('Fixture host is not an HTMLElement');
  }
  return element;
}

/** Finds a required element inside a container, failing the test with a clear message otherwise. */
export function requireElement<T extends Element>(
  container: ParentNode,
  selector: string,
  type: abstract new () => T,
): T {
  const found = container.querySelector(selector);
  if (!(found instanceof type)) {
    throw new Error(`Element "${selector}" not found or has unexpected type`);
  }
  return found;
}

/** A `<button>` whose text (or aria-label) contains the given text. */
export function buttonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) =>
      candidate.textContent.includes(text) || candidate.getAttribute('aria-label') === text,
  );
  if (button === undefined) {
    throw new Error(`Button "${text}" not found`);
  }
  return button;
}

/** Types a value into an input the way a user would (fires the `input` event). */
export function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Text content of the whole document body (dialogs and overlays are appended to the body). */
export function bodyText(): string {
  return document.body.textContent;
}

/**
 * Visible text for assertions: text nodes joined with single spaces, all whitespace (including the
 * non-breaking spaces used by number formatting) collapsed. «Поступления</span><span>5 000 ₽» becomes
 * «Поступления 5 000 ₽».
 */
export function readableText(root: Node): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    parts.push(node.textContent ?? '');
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
