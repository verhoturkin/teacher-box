import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MaterialCard } from './material-card';

@Component({
  imports: [MaterialCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-material-card
      title="Алгебра"
      supporting="Мария · 02.10"
      icon="tb-i-co_present"
      actionsLabel="Действия: Алгебра"
      [routerLink]="['/boards', 'b-1']"
      [loader]="loader"
      ref="b-1"
      [menuOpen]="true"
      (menu)="menus = menus + 1"
    />
    <tb-material-card
      title="Холст"
      icon="tb-i-dashboard"
      actionsLabel="Действия: Холст"
      href="https://holst.so/1"
      tag="Холст"
      [tonal]="true"
    />
    <tb-material-card
      title="Учебник"
      icon="tb-i-menu_book"
      actionsLabel="Действия: Учебник"
      openLabel="Открыть Учебник"
      (open)="opened = opened + 1"
    />
  `,
})
class Host {
  menus = 0;
  opened = 0;
  readonly loader = () => of(new Blob(['png']));
}

describe('MaterialCard', () => {
  let fixture: ComponentFixture<Host>;
  let host: HTMLElement;

  beforeEach(async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:card');
    TestBed.configureTestingModule({ providers: [...testProviders(), provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    host = hostElement(fixture);
    await fixture.whenStable();
  });

  it('opens by a link inside the portal, by an outer link in a new tab or by a button', () => {
    const titles = host.querySelectorAll('.tb-material-card__title');
    expect(titles[0]?.getAttribute('href')).toBe('/boards/b-1');
    expect(titles[1]?.getAttribute('href')).toBe('https://holst.so/1');
    expect(titles[1]?.getAttribute('target')).toBe('_blank');
    expect(titles[2]?.tagName).toBe('BUTTON');
    expect(titles[2]?.getAttribute('aria-label')).toBe('Открыть Учебник');
    host.querySelector<HTMLButtonElement>('button.tb-material-card__title')?.click();
    expect(fixture.componentInstance.opened).toBe(1);
  });

  it('shows the picture, the tag on a tonal tile and «⋮» that tells it is open', () => {
    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:card');
    expect(host.querySelector('.tb-material-card__tag')?.textContent).toContain('Холст');
    expect(host.querySelectorAll('.tb-material-card__preview--tonal')).toHaveLength(1);
    const menu = host.querySelector<HTMLButtonElement>('button[aria-label="Действия: Алгебра"]');
    expect(menu?.getAttribute('aria-expanded')).toBe('true');
    menu?.click();
    expect(fixture.componentInstance.menus).toBe(1);
    expect(host.textContent).toContain('Мария · 02.10');
  });
});
