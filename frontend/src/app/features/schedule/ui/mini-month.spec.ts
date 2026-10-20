import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { MiniMonth } from './mini-month';

describe('MiniMonth', () => {
  let fixture: ComponentFixture<MiniMonth>;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MiniMonth] });
    fixture = TestBed.createComponent(MiniMonth);
    fixture.componentRef.setInput('current', '2026-10-20');
    fixture.componentRef.setInput('marked', new Set(['2026-10-21']));
    fixture.detectChanges();
    await fixture.whenStable();
    host = hostElement(fixture);
  });

  function day(iso: string): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`);
    if (button === null) {
      throw new Error(`No day ${iso}`);
    }
    return button;
  }

  it('shows the month from Monday with the current day and the days with lessons marked', () => {
    expect(host.textContent).toContain('октябрь 2026');
    // 1 October 2026 is a Thursday: the grid starts on Monday, 28 September
    expect(host.querySelector('[data-date]')?.getAttribute('data-date')).toBe('2026-09-28');
    expect(day('2026-09-28').classList).toContain('tb-mini-month__day--outside');
    expect(day('2026-10-20').getAttribute('aria-pressed')).toBe('true');
    expect(day('2026-10-21').classList).toContain('tb-mini-month__day--marked');
    expect(day('2026-10-22').classList).not.toContain('tb-mini-month__day--marked');
  });

  it('asks the calendar to go to a day', () => {
    const picked: string[] = [];
    fixture.componentInstance.dateSelect.subscribe((iso) => picked.push(iso));

    day('2026-10-05').click();

    expect(picked).toEqual(['2026-10-05']);
  });

  it('moves between months on its own and follows the calendar', async () => {
    const [previous, next] = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).filter(
      (button) => button.hasAttribute('aria-label'),
    );
    next?.click();
    await fixture.whenStable();
    expect(host.textContent).toContain('ноябрь 2026');
    previous?.click();
    previous?.click();
    await fixture.whenStable();
    expect(host.textContent).toContain('сентябрь 2026');

    fixture.componentRef.setInput('current', '2026-12-03');
    await fixture.whenStable();
    expect(host.textContent).toContain('декабрь 2026');
  });

  it('marks today', () => {
    const today = new Date();
    fixture.componentRef.setInput(
      'current',
      `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
    );
    fixture.detectChanges();
    expect(host.querySelector('[aria-current="date"]')).not.toBeNull();
  });
});
