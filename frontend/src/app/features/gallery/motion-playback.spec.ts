import { TestBed } from '@angular/core/testing';
import { buttonByText, hostElement, requireElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { MotionPlayback, REDUCED_CLASS, Replay } from './motion-playback';

function render(replay = true) {
  TestBed.configureTestingModule({ providers: testProviders(MotionPlayback) });
  const fixture = TestBed.createComponent(Replay);
  fixture.componentRef.setInput('replay', replay);
  fixture.detectChanges();
  return { fixture, host: hostElement(fixture), playback: TestBed.inject(MotionPlayback) };
}

describe('MotionPlayback and Replay', () => {
  afterEach(() => {
    document.documentElement.classList.remove(REDUCED_CLASS);
  });

  it('counts the rounds of «Replay»', () => {
    const { host, playback } = render();
    buttonByText(host, 'Replay').click();
    buttonByText(host, 'Replay').click();
    expect(playback.round()).toBe(2);
  });

  it('has no «Replay» where the sample starts the motion itself', () => {
    const { host } = render(false);
    expect(host.textContent).not.toContain('Replay');
    expect(host.textContent).toContain('Reduce motion');
  });

  it('emulates reduced motion on the page while the gallery is open', async () => {
    const { fixture, host, playback } = render();
    expect(playback.reduced()).toBe(false);
    requireElement(host, 'input[type="checkbox"]', HTMLInputElement).click();
    await fixture.whenStable();
    expect(playback.reduced()).toBe(true);
    expect(document.documentElement.classList.contains(REDUCED_CLASS)).toBe(true);
    playback.reduce(false);
    expect(document.documentElement.classList.contains(REDUCED_CLASS)).toBe(false);
    playback.reduce(true);
    TestBed.resetTestingModule();
    expect(document.documentElement.classList.contains(REDUCED_CLASS)).toBe(false);
  });
});
