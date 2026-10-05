import { OpenCards } from './open-cards';

describe('OpenCards', () => {
  it('opens and closes the details of each card on its own', () => {
    const cards = new OpenCards();
    expect(cards.isOpen('a')).toBe(false);
    expect(cards.icon('a')).toBe('pi pi-chevron-down');

    cards.toggle('a');
    expect(cards.isOpen('a')).toBe(true);
    expect(cards.isOpen('b')).toBe(false);
    expect(cards.icon('a')).toBe('pi pi-chevron-up');

    cards.toggle('b');
    cards.toggle('a');
    expect(cards.isOpen('a')).toBe(false);
    expect(cards.isOpen('b')).toBe(true);
  });
});
