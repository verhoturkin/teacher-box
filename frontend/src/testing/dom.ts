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
export function requireElement<T extends Element = HTMLElement>(
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
