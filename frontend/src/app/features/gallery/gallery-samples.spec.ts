import { TestBed } from '@angular/core/testing';
import { hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { GALLERY_SECTIONS } from './gallery-sections';
import { MotionPlayback } from './motion-playback';

const SAMPLES = GALLERY_SECTIONS.flatMap((section) => section.samples);

describe('gallery samples (ADR-0059)', () => {
  it.each(SAMPLES.map((sample) => [sample.path, sample] as const))(
    '%s renders with a caption of what it shows',
    (_path, sample) => {
      TestBed.configureTestingModule({ providers: testProviders(MotionPlayback) });
      const fixture = TestBed.createComponent(sample.component);
      fixture.detectChanges();
      const host = hostElement(fixture);
      expect(host.textContent.trim()).not.toBe('');
      expect(host.querySelector('code, .tb-gallery-name')).not.toBeNull();
    },
  );

  it('names every sample once', () => {
    const paths = SAMPLES.map((sample) => sample.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
