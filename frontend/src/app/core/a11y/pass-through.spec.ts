import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Card } from 'primeng/card';
import { providePrimeNG } from 'primeng/config';
import { Dialog } from 'primeng/dialog';
import { hostElement } from '@testing/dom';
import { PASS_THROUGH } from './pass-through';

@Component({
  imports: [Card, Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Оплаты">Текст</p-card>
    <p-dialog header="Новый ученик" [visible]="true" [modal]="true">Поле</p-dialog>
  `,
})
class Host {}

describe('PASS_THROUGH', () => {
  it('makes the titles of cards headings and names the «×» of dialogs', async () => {
    TestBed.configureTestingModule({ providers: [providePrimeNG({ pt: PASS_THROUGH })] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const title = hostElement(fixture).querySelector('.p-card-title');
    expect(title?.getAttribute('role')).toBe('heading');
    expect(title?.getAttribute('aria-level')).toBe('2');
    const close = document.body.querySelector('.p-dialog-close-button');
    expect(close?.getAttribute('aria-label')).toBe('Закрыть');
    fixture.destroy();
  });
});
