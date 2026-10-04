import { Subject } from 'rxjs';
import { Busy } from './busy';

describe('Busy', () => {
  it('runs one request per key at a time and shows it as busy', () => {
    const busy = new Busy();
    const first = new Subject<string>();
    const results: string[] = [];

    busy.guard('retry', first).subscribe((value) => results.push(value));
    expect(busy.is('retry')).toBe(true);
    expect(busy.any()).toBe(true);

    // a second press of the same action does nothing
    let second = false;
    busy.guard('retry', first).subscribe({ complete: () => (second = true) });
    expect(second).toBe(true);
    expect(first.observed).toBe(true);

    first.next('a');
    first.complete();
    expect(results).toEqual(['a']);
    expect(busy.is('retry')).toBe(false);
    expect(busy.any()).toBe(false);
  });

  it('lets different keys run together and frees the key after an error', () => {
    const busy = new Busy();
    const one = new Subject<void>();
    const other = new Subject<void>();

    busy.guard('one', one).subscribe({ error: () => undefined });
    busy.guard('other', other).subscribe();
    expect(busy.is('one') && busy.is('other')).toBe(true);
    expect(busy.is()).toBe(false);

    one.error(new Error('failed'));
    expect(busy.is('one')).toBe(false);
    expect(busy.is('other')).toBe(true);
  });
});
