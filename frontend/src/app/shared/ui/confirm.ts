import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ConfirmationRequest, dangerConfirmation, safeConfirmation } from './confirmation';

/** What the dialog says; the buttons are fixed by the kind of the confirmation. */
export type ConfirmRequest = Pick<
  ConfirmationRequest,
  'header' | 'message' | 'acceptLabel' | 'icon'
>;

/**
 * The only way to ask «Are you sure?» (ADR-0050): the one host `<p-confirmdialog>` lives in `App`.
 * Resolves `true` on the action and `false` on «Отмена», the close button and Escape.
 */
@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly service = inject(ConfirmationService);

  /** An irreversible action: a filled red button (ADR-0019, ADR-0026). */
  danger(request: ConfirmRequest): Promise<boolean> {
    return this.ask(dangerConfirmation, request);
  }

  /** An ordinary action: a filled primary button (ADR-0045). */
  safe(request: ConfirmRequest): Promise<boolean> {
    return this.ask(safeConfirmation, request);
  }

  private ask(build: typeof dangerConfirmation, request: ConfirmRequest): Promise<boolean> {
    return new Promise((resolve) => {
      this.service.confirm(
        build({
          ...request,
          accept: () => {
            resolve(true);
          },
          reject: () => {
            resolve(false);
          },
        }),
      );
    });
  }
}
