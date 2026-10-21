import { sortMaterials } from './material-sort';

describe('sortMaterials', () => {
  const items = [
    { title: 'Б', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-03T10:00:00Z' },
    { title: 'А', createdAt: '2026-10-02T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' },
    { title: 'В', createdAt: '2026-10-03T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z' },
  ];
  const order = (sort: Parameters<typeof sortMaterials>[1]): string[] =>
    sortMaterials(items, sort).map((item) => item.title);

  it('orders by the latest change, by title and by the newest, leaving the source as it was', () => {
    expect(order('changed')).toEqual(['Б', 'В', 'А']);
    expect(order('title')).toEqual(['А', 'Б', 'В']);
    expect(order('created')).toEqual(['В', 'А', 'Б']);
    expect(items.map((item) => item.title)).toEqual(['Б', 'А', 'В']);
  });
});
