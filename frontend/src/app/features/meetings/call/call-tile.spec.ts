import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { aMediaRef, aParticipant } from '@testing/meetings-fixtures';
import { testProviders } from '@testing/setup';
import { CallTile } from './call-tile';

describe('CallTile', () => {
  let fixture: ComponentFixture<CallTile>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CallTile], providers: testProviders() });
    fixture = TestBed.createComponent(CallTile);
  });

  afterEach(() => {
    fixture.destroy();
  });

  async function show(inputs: Record<string, unknown>): Promise<HTMLElement> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return hostElement(fixture);
  }

  it('attaches the camera and moves to the next track, then detaches on leave', async () => {
    const first = aMediaRef('TR_1');
    const second = aMediaRef('TR_2');
    const host = await show({ participant: aParticipant({ camera: first }) });
    const video = host.querySelector('video');

    expect(first.attached).toEqual([video]);
    expect(host.querySelector('video')?.classList).toContain('tb-call-tile__video--mirror');

    await show({ participant: aParticipant({ camera: first, speaking: true }) });
    expect(first.attached).toHaveLength(1);
    expect(host.classList).toContain('tb-call-tile--speaking');

    await show({ participant: aParticipant({ camera: second }) });
    expect(first.attached).toEqual([]);
    expect(second.attached).toHaveLength(1);

    await show({ participant: aParticipant({ camera: null }) });
    expect(second.attached).toEqual([]);
    expect(host.querySelector('.tb-call-tile__avatar')?.textContent.trim()).toBe('О');
  });

  it('names this user, a crossed microphone and a weak connection', async () => {
    const host = await show({
      participant: aParticipant({ microphone: false, quality: 'poor' }),
    });

    expect(host.textContent).toContain('Ольга (вы)');
    expect(host.querySelector('.tb-call-crossed')).not.toBeNull();
    expect(host.querySelector('.tb-call-tile__weak')).not.toBeNull();
    expect(host.getAttribute('aria-label')).toBe(
      'Ольга (вы), микрофон выключен, камера выключена, слабая связь',
    );
  });

  it('shows a shared screen without mirroring and without the microphone', async () => {
    const screen = aMediaRef('TR_screen');
    const host = await show({
      participant: aParticipant({
        id: 's-1',
        name: 'Анна',
        local: false,
        microphone: false,
        camera: aMediaRef('TR_cam'),
        screen,
      }),
      screen: true,
    });

    expect(screen.attached).toHaveLength(1);
    expect(host.classList).toContain('tb-call-tile--screen');
    expect(host.querySelector('.tb-call-crossed')).toBeNull();
    expect(host.querySelector('video')?.classList).not.toContain('tb-call-tile__video--mirror');
    expect(host.getAttribute('aria-label')).toBe('Экран: Анна');

    await show({ participant: aParticipant({ local: false, camera: aMediaRef() }), screen: false });
    expect(host.getAttribute('aria-label')).toBe('Ольга, микрофон включён, камера включена');
  });
});
