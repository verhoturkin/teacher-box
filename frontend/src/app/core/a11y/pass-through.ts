import { GlobalPassThrough } from 'primeng/config';

const CLOSE = { root: { 'aria-label': 'Закрыть' } };

/**
 * Attributes PrimeNG components do not set by themselves (ADR-0024): the title of a card is a
 * heading of a section (h2), the «×» of dialogs and drawers is named «Закрыть».
 */
export const PASS_THROUGH: GlobalPassThrough = {
  card: { title: { role: 'heading', 'aria-level': '2' } },
  dialog: { pcCloseButton: CLOSE },
  drawer: { pcCloseButton: CLOSE },
};
