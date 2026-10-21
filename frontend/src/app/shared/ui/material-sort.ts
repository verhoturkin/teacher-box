/** How the Materials feed is ordered: the latest change first, by title, the newest first. */
export type MaterialSort = 'changed' | 'title' | 'created';

/** What a material gives for sorting. */
export interface Sortable {
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The materials in the order of `sort` (a new array). ISO times compare as strings. */
export function sortMaterials<T extends Sortable>(items: readonly T[], sort: MaterialSort): T[] {
  const copy = [...items];
  switch (sort) {
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    case 'created':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'changed':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
