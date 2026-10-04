import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { By } from '@angular/platform-browser';
import { Snackbar } from '@core/snackbar/snackbar';
import { hostElement } from '@testing/dom';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), MessageService],
    });
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
