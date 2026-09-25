import { Directive, input } from '@angular/core';

/** Template context of a PrimeNG table row. */
export interface RowContext<T> {
  readonly $implicit: T;
  readonly rowIndex: number;
}

/**
 * Gives PrimeNG row templates a static type (PrimeNG types them as `any`):
 *
 * ```html
 * <ng-template #body let-student [tbRowType]="students()">{{ student.displayName }}</ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[tbRowType]' })
export class RowType<T> {
  /** The table data; used only to infer the row type. */
  readonly tbRowType = input.required<readonly T[]>();

  static ngTemplateContextGuard<T>(_directive: RowType<T>, context: unknown): context is RowContext<T> {
    return context !== null;
  }
}
