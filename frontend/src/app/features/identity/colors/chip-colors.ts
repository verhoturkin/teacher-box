import { Directive, ElementRef, afterEveryRender, effect, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { labelKey } from '@core/theme/label-colors';
import { TeacherColors } from './teacher-colors';

/**
 * Paints the chips of a student or group multiselect (`display="chip"`, values are ids) in the colours of the
 * students or groups. PrimeNG draws one chip per value in the order of the value and gives a chip no hook of its
 * own, so the chips get `data-tb-label` after every render.
 */
@Directive({ selector: 'p-multiselect[tbChipColors]' })
export class ChipColors {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly control = inject(NgControl, { self: true });
  private readonly colors = inject(TeacherColors);

  /** What the values are ids of. */
  readonly tbChipColors = input.required<'student' | 'group'>();

  constructor() {
    afterEveryRender(() => {
      this.paint();
    });
    // the colours load after the field is drawn
    effect(() => {
      this.paint();
    });
  }

  private paint(): void {
    // read before the chips: the effect follows the colours even while there are no chips yet
    const colors = this.colors.all(this.tbChipColors());
    const value: unknown = this.control.value;
    const ids = Array.isArray(value) ? value : [];
    const chips = this.host.nativeElement.querySelectorAll<HTMLElement>('.p-multiselect-chip');
    chips.forEach((chip, index) => {
      const id: unknown = ids[index];
      const color = typeof id === 'string' ? (colors.get(id) ?? null) : null;
      if (color === null) {
        chip.removeAttribute('data-tb-label');
      } else {
        chip.setAttribute('data-tb-label', labelKey(color));
      }
    });
  }
}
