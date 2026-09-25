import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
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
});
