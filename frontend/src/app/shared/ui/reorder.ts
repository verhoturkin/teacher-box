/** −1 for ↑, 1 for ↓, `null` for any other key: moving an item of a list from its drag handle. */
export function arrowStep(event: KeyboardEvent): -1 | 1 | null {
  if (event.key === 'ArrowUp') {
    return -1;
  }
  return event.key === 'ArrowDown' ? 1 : null;
}

/** The list with the item moved from one place to another (a drop of CDK drag-drop). */
export function reordered<A>(list: readonly A[], from: number, to: number): readonly A[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  if (item !== undefined) {
    copy.splice(to, 0, item);
  }
  return copy;
}
