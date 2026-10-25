import { TestBed } from '@angular/core/testing';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { Confirm } from './confirm';

describe('Confirm', () => {
  let confirm: Confirm;
  let shown: Confirmation;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ConfirmationService] });
    const service = TestBed.inject(ConfirmationService);
    vi.spyOn(service, 'confirm').mockImplementation((confirmation) => {
      shown = confirmation;
      return service;
    });
    confirm = TestBed.inject(Confirm);
  });

  it('resolves true on the action of a danger confirmation, which is red', async () => {
    const answer = confirm.danger({
      header: 'Удалить?',
      message: 'Точно?',
      acceptLabel: 'Удалить',
    });

    expect(shown.header).toBe('Удалить?');
    expect(shown.acceptLabel).toBe('Удалить');
    expect(shown.acceptButtonProps).toEqual({ severity: 'danger' });
    shown.accept?.();

    expect(await answer).toBe(true);
  });

  it('resolves false on «Отмена» and the close button', async () => {
    const answer = confirm.danger({ header: 'Удалить?', acceptLabel: 'Удалить' });

    expect(shown.rejectLabel).toBe('Отмена');
    shown.reject?.();

    expect(await answer).toBe(false);
  });

  it('makes a safe confirmation primary', async () => {
    const answer = confirm.safe({ header: 'Перенести?', acceptLabel: 'Перенести' });

    expect(shown.acceptButtonProps).toEqual({ severity: 'primary' });
    expect(shown.rejectLabel).toBe('Отмена');
    shown.accept?.();

    expect(await answer).toBe(true);
  });
});
