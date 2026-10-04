import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Drawer } from 'primeng/drawer';
import { testProviders } from '@testing/setup';
import { hostElement } from '@testing/dom';
import { ModalDrawer } from './modal-drawer';

@Component({
  imports: [Drawer, ModalDrawer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="opener" (click)="open.set(true)">Занятие</button>
    <p-drawer tbModalDrawer [(visible)]="open" header="Пн 18:00" position="bottom">
      <button type="button" class="action" (click)="open.set(false)">Подключиться</button>
    </p-drawer>
  `,
})
class Host {
  readonly open = signal(false);
}

describe('ModalDrawer', () => {
  it('is a named modal dialog, takes the focus to its first action and gives it back', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const opener = hostElement(fixture).querySelector<HTMLButtonElement>('.opener');
    opener?.focus();
    opener?.click();
    await fixture.whenStable();
    const drawer = fixture.debugElement.query(By.directive(Drawer)).injector.get(Drawer);
    drawer.show();
    const container = drawer.container;

    expect(container?.getAttribute('role')).toBe('dialog');
    expect(container?.getAttribute('aria-modal')).toBe('true');
    const title = container?.querySelector('.p-drawer-title');
    expect(container?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(document.activeElement?.textContent).toBe('Подключиться');

    drawer.visibleChange.emit(false);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.activeElement).toBe(opener);
    drawer.hide();
    fixture.destroy();
  });

  it('takes its shade away when the page is left while it closes', async () => {
    TestBed.configureTestingModule({ providers: testProviders() });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(document.body.querySelector('.p-drawer-mask')).not.toBeNull();

    fixture.componentInstance.open.set(false);
    fixture.destroy();

    expect(document.body.querySelector('.p-drawer-mask')).toBeNull();
  });
});
