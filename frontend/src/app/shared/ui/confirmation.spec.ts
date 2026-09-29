import { dangerConfirmation, safeConfirmation } from './confirmation';

describe('confirmations', () => {
  it('makes the irreversible action red and «Назад» neutral', () => {
    expect(dangerConfirmation({ header: 'Удалить?', acceptLabel: 'Удалить' })).toEqual({
      header: 'Удалить?',
      acceptLabel: 'Удалить',
      rejectLabel: 'Назад',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
    });
  });

  it('makes an ordinary action green and its cancel red', () => {
    expect(safeConfirmation({ acceptLabel: 'Перенести', rejectLabel: 'Не переносить' })).toEqual({
      acceptLabel: 'Перенести',
      rejectLabel: 'Не переносить',
      acceptButtonProps: { severity: 'success' },
      rejectButtonProps: { severity: 'danger', text: true },
    });
  });
});
