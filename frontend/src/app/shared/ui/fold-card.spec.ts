import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { FoldCard } from './fold-card';

@Component({
  selector: 'tb-counted',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Содержимое</p>`,
})
class Counted {
  static created = 0;

  constructor() {
    Counted.created++;
  }
}

@Component({
  imports: [FoldCard, Counted],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-fold-card id="inbox" title="Входящие" [collapsible]="false" [badge]="unread()">
      <ng-template><p>Письма</p></ng-template>
    </tb-fold-card>
    <tb-fold-card
      id="settings"
      title="Мессенджеры"
      summary="Боты и ваши мессенджеры"
      [single]="true"
      [(open)]="open"
    >
      <ng-template><tb-counted /></ng-template>
    </tb-fold-card>
  `,
})
class Host {
  readonly unread = signal(3);
  readonly open = signal(false);
}

describe('FoldCard', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    Counted.created = 0;
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function card(id: string): HTMLElement {
    return requireElement(hostElement(fixture), `#${id}`, HTMLElement);
  }

  it('keeps a card that does not fold open, with its counter and no toggle', async () => {
    expect(card('inbox').querySelector('button')).toBeNull();
    expect(readableText(card('inbox'))).toContain('Входящие 3');
    expect(readableText(card('inbox'))).toContain('Письма');
    expect(card('inbox').classList).toContain('tb-fold-card--open');

    fixture.componentInstance.unread.set(0);
    await fixture.whenStable();
    expect(card('inbox').querySelector('p-badge')).toBeNull();
  });

  it('renders the content of a folded card only when it is opened', async () => {
    const toggle = requireElement(card('settings'), 'button', HTMLButtonElement);
    expect(readableText(toggle)).toContain('Мессенджеры');
    expect(readableText(toggle)).toContain('Боты и ваши мессенджеры');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(Counted.created).toBe(0);
    const body = requireElement(card('settings'), '.tb-fold-card__body', HTMLElement);
    expect(toggle.getAttribute('aria-controls')).toBe(body.id);
    expect(card('settings').classList).toContain('tb-fold-card--single');

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.open()).toBe(true);
    expect(readableText(body)).toContain('Содержимое');
    expect(Counted.created).toBe(1);

    toggle.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(body.querySelector('tb-counted')).toBeNull();
  });

  it('opens from the outside', async () => {
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();

    expect(card('settings').classList).toContain('tb-fold-card--open');
    expect(readableText(card('settings'))).toContain('Содержимое');
  });
});
