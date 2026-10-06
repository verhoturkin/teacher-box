import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aParticipant } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallStats } from './call-engine';
import { CallSession } from './call-session';
import { CallStatsDialog, STATS_INTERVAL } from './call-stats-dialog';

const STATS: CallStats = {
  serverVersion: '1.13.7',
  transport: {
    protocol: 'udp',
    candidate: 'host',
    relayProtocol: null,
    localPort: 50_000,
    remoteAddress: '203.0.113.5',
    remotePort: 7882,
    roundTrip: 40,
    outgoingBitrate: 2000,
  },
  audioIn: null,
  audioOutLoss: null,
  videoOut: null,
  videoOutLimit: null,
  videoIn: null,
};

describe('CallStatsDialog', () => {
  let fixture: ComponentFixture<CallStatsDialog>;
  let session: CallSession;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    TestBed.configureTestingModule({ imports: [CallStatsDialog], providers: testProviders() });
    session = TestBed.inject(CallSession);
    session.participants.set([aParticipant({ name: 'Учитель', quality: 'good' })]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function dialogText(): string {
    return document.querySelector('.tb-call-stats')?.textContent ?? '';
  }

  it('reads the details again while open and stops when closed', async () => {
    const read = vi.spyOn(session, 'stats').mockResolvedValue(null);
    fixture = TestBed.createComponent(CallStatsDialog);
    await fixture.whenStable();

    expect(dialogText()).toContain('Учитель (вы)');
    expect(dialogText()).toContain('хорошая');
    expect(dialogText()).toContain('Подробности появятся');

    read.mockResolvedValue(STATS);
    vi.advanceTimersByTime(STATS_INTERVAL);
    await Promise.resolve();
    await fixture.whenStable();
    expect(read).toHaveBeenCalledTimes(2);
    expect(dialogText()).toContain('UDP');
    expect(dialogText()).toContain('203.0.113.5:7882');
    expect(dialogText()).not.toContain('Подробности появятся');

    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    const close = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Закрыть',
    );
    close?.click();
    expect(closed).toBe(1);

    fixture.destroy();
    vi.advanceTimersByTime(STATS_INTERVAL * 3);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
