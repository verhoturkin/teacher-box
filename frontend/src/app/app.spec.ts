import { provideHttpClient } from '@angular/common/http';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { By } from '@angular/platform-browser';
import { Snackbar } from '@core/snackbar/snackbar';
import { hostElement } from '@testing/dom';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), MessageService, provideHttpClient()],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    // the call host is a deferred block (ADR-0030)
    await TestBed.compileComponents();
  });

  it('loads the call host above the routes once the page is idle', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(hostElement(fixture).querySelector('tb-call-host')).toBeNull();

    const [call] = await fixture.getDeferBlocks();
    await call?.render(DeferBlockState.Complete);

    expect(hostElement(fixture).querySelector('tb-call-host')).not.toBeNull();
  });

  it('renders the toast host and the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = hostElement(fixture);

    expect(element.querySelector('p-toast')).not.toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows a snackbar that does not take the focus and has «Закрыть»', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    TestBed.inject(Snackbar).error('Нет связи');
    await fixture.whenStable();

    const close = document.body.querySelector('.tb-snackbar__close');
    expect(close?.getAttribute('aria-label')).toBe('Закрыть');
    expect(document.activeElement).not.toBe(close);
    expect(document.body.querySelector('.tb-snackbar__text')?.getAttribute('role')).toBe('alert');
    expect(document.body.querySelector('.p-toast-message')?.getAttribute('role')).toBe('status');
    fixture.destroy();
  });

  it('lets the snackbar show a closed message again', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const closed = vi.spyOn(TestBed.inject(Snackbar), 'closed');
    const toast = fixture.debugElement.query(By.directive(Toast)).injector.get(Toast);

    toast.onClose.emit({ message: { severity: 'success', detail: 'Сохранено' } });

    expect(closed).toHaveBeenCalledWith({ severity: 'success', detail: 'Сохранено' });
  });
});
