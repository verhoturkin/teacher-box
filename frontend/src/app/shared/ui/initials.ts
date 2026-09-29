import { Pipe, PipeTransform } from '@angular/core';

/**
 * The initials of a name for the avatar of a list row (ADR-0020): the first letters of the first
 * two words, upper case — «Анна Смирнова» → «АС», «Борис» → «Б», «Группа «ОГЭ»» → «ГО».
 */
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return (name ?? '')
      .split(/\s+/)
      .map((word) => /[\p{L}\p{N}]/u.exec(word)?.[0] ?? '')
      .filter((letter) => letter !== '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
