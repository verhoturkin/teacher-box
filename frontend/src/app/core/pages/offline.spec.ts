import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { buttonByText, hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { Snackbar } from '@core/snackbar/snackbar';
import { OfflinePage } from './offline';

describe('OfflinePage', () => {
  function open(online: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
    TestBed.configureTestingModule({ imports: [OfflinePage], providers: [testProviders()] });
    const fixture = TestBed.createComponent(OfflinePage);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('says there is no connection and goes home once it is back', () => {
    const fixture = open(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    expect(hostElement(fixture).textContent).toContain('Нет связи');

    buttonByText(hostElement(fixture), 'Повторить').click();

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('stays and tells so while the network is still down', () => {
    const fixture = open(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const info = vi.spyOn(TestBed.inject(Snackbar), 'info');
    void TestBed.inject(MessageService);

    buttonByText(hostElement(fixture), 'Повторить').click();

    expect(navigate).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Нет связи с порталом');
  });
});
