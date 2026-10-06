import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { aParticipant } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallHost } from './call-host';
import { CallSession } from './call-session';

describe('CallHost', () => {
  let fixture: ComponentFixture<CallHost>;
  let session: CallSession;
  let host: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-06T10:00:00Z'));
    TestBed.configureTestingModule({ imports: [CallHost], providers: testProviders() });
    session = TestBed.inject(CallSession);
    fixture = TestBed.createComponent(CallHost);
    await fixture.whenStable();
    host = hostElement(fixture);
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('shows nothing without a call', () => {
    expect(host.textContent.trim()).toBe('');
    expect(document.documentElement.classList).not.toContain('tb-call-expanded');
  });

  it('shows the pre-join sheet and says which call ends', async () => {
    session.target.set({ ownerId: 's-1', title: 'Анна' });
    session.phase.set('connected');
    session.prejoin.set({ ownerId: 'g-1', title: 'ОГЭ' });
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Звонок: ОГЭ');
    expect(document.body.textContent).toContain('Звонок «Анна» завершится.');
    session.prejoin.set(null);
    session.phase.set('idle');
    await fixture.whenStable();
  });

  it('counts the time in the full window and keeps the page still, then minimizes', async () => {
    session.target.set({ ownerId: 'g-1', title: 'ОГЭ' });
    session.participants.set([aParticipant()]);
    session.phase.set('connected');
    session.startedAt.set(Date.now());
    await fixture.whenStable();

    expect(host.querySelector('tb-call-window')).not.toBeNull();
    expect(document.documentElement.classList).toContain('tb-call-expanded');
    vi.advanceTimersByTime(65_000);
    await fixture.whenStable();
    expect(host.textContent).toContain('1:05');

    session.minimize();
    await fixture.whenStable();
    expect(host.querySelector('tb-call-mini')).not.toBeNull();
    expect(document.documentElement.classList).not.toContain('tb-call-expanded');

    fixture.destroy();
    expect(document.documentElement.classList).not.toContain('tb-call-expanded');
  });
});
