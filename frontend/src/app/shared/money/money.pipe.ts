import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from './money';

/** `{{ 150000 | money: 'RUB' }}` → «1 500 ₽». */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(minor: number, currency: string): string {
    return formatMoney(minor, currency);
  }
}
