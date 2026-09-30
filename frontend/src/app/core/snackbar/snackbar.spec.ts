import { TestBed } from '@angular/core/testing';
import { MessageService, ToastMessageOptions } from 'primeng/api';
import { SNACKBAR_ERROR_LIFE, SNACKBAR_LIFE, Snackbar } from './snackbar';

describe('Snackbar', () => {
  let snackbar: Snackbar;
  let shown: ToastMessageOptions[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MessageService] });
    snackbar = TestBed.inject(Snackbar);
    shown = [];
    vi.spyOn(TestBed.inject(MessageService), 'add').mockImplementation((message) => {
      shown.push(message);
    });
  });

  it('shows a result for 5 s and an error for 8 s, without a title', () => {
    snackbar.success('Сохранено');
    snackbar.info('Ссылка скопирована');
    snackbar.error('Не удалось сохранить');

    expect(shown).toEqual([
      { severity: 'success', detail: 'Сохранено', life: SNACKBAR_LIFE },
      { severity: 'info', detail: 'Ссылка скопирована', life: SNACKBAR_LIFE },
      { severity: 'error', detail: 'Не удалось сохранить', life: SNACKBAR_ERROR_LIFE },
    ]);
  });

  it('does not repeat a message while it is on the screen', () => {
    snackbar.error('Нет связи');
    snackbar.error('Нет связи');
    snackbar.success('Нет связи');

    expect(shown).toHaveLength(2);
  });

  it('shows the message again after it was closed or its time ran out', () => {
    vi.useFakeTimers();
    try {
      snackbar.success('Сохранено');
      snackbar.closed({ severity: 'success', detail: 'Сохранено' });
      snackbar.success('Сохранено');
      vi.advanceTimersByTime(SNACKBAR_LIFE + 1);
      snackbar.success('Сохранено');
    } finally {
      vi.useRealTimers();
    }

    expect(shown).toHaveLength(3);
  });

  it('forgets a closed message without a severity or text', () => {
    snackbar.closed({});

    snackbar.info('Готово');

    expect(shown).toHaveLength(1);
  });
});
