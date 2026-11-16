import { Confirmation } from 'primeng/api';
import { dangerConfirmation, safeConfirmation } from './confirmation';

describe('confirmations', () => {
  it('makes the irreversible action red, «Отмена» neutral and shows the ⚠ sign', () => {
    expect(dangerConfirmation({ header: 'Удалить?', acceptLabel: 'Удалить' })).toEqual({
      header: 'Удалить?',
      acceptLabel: 'Удалить',
      icon: 'tb-i tb-i-warning',
      rejectLabel: 'Отмена',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
    });
  });

  it('makes an ordinary action primary and «Отмена» neutral', () => {
    expect(safeConfirmation({ acceptLabel: 'Перенести' })).toEqual({
      acceptLabel: 'Перенести',
      rejectLabel: 'Отмена',
      acceptButtonProps: { severity: 'primary' },
      rejectButtonProps: { severity: 'secondary', text: true },
    });
  });

  it('does not let the rejection be overridden', () => {
    const attempt: Confirmation = {
      rejectLabel: 'Назад',
      rejectButtonProps: { severity: 'danger' },
    };

    expect(dangerConfirmation(attempt).rejectLabel).toBe('Отмена');
    expect(dangerConfirmation(attempt).rejectButtonProps).toEqual({
      severity: 'secondary',
      text: true,
    });
    expect(safeConfirmation(attempt).rejectLabel).toBe('Отмена');
    expect(safeConfirmation(attempt).rejectButtonProps).toEqual({
      severity: 'secondary',
      text: true,
    });
  });
});
