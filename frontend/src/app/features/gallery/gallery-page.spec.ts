import { TestBed } from '@angular/core/testing';
import { ThemeMode } from '@core/theme/theme-mode';
import { buttonByText, hostElement } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { GALLERY_SECTIONS } from './gallery-sections';
import { GalleryPage, SAMPLE_ROOT } from './gallery-page';

function render(): HTMLElement {
  TestBed.configureTestingModule({ providers: testProviders() });
  const fixture = TestBed.createComponent(GalleryPage);
  fixture.detectChanges();
  return hostElement(fixture);
}

describe('GalleryPage', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('tb-dark');
  });

  it('shows a section per part with its anchor in the section nav', () => {
    const page = render();
    const ids = GALLERY_SECTIONS.map((section) => section.id);
    expect(Array.from(page.querySelectorAll('section'), (section) => section.id)).toEqual(ids);
    const anchors = Array.from(page.querySelectorAll('tb-section-nav a'), (a) =>
      a.getAttribute('href'),
    );
    expect(anchors).toEqual(ids.map((id) => `#${id}`));
  });

  it('shows every sample with the file it lives in', () => {
    const page = render();
    const paths = Array.from(
      page.querySelectorAll('.tb-gallery-sample__path'),
      (code) => code.textContent,
    );
    const expected = GALLERY_SECTIONS.flatMap((section) =>
      section.samples.map((sample) => `${SAMPLE_ROOT}${sample.path}`),
    );
    expect(paths).toEqual(expected);
    for (const body of Array.from(page.querySelectorAll('.tb-gallery-sample__body'))) {
      expect(body.textContent.trim()).not.toBe('');
    }
  });

  it('keeps one sample in one file of a section folder', () => {
    for (const section of GALLERY_SECTIONS) {
      for (const sample of section.samples) {
        expect(sample.path).toMatch(new RegExp(`^${section.id}/[a-z-]+\\.ts$`));
      }
    }
  });

  it('switches the theme of the portal', () => {
    const page = render();
    const mode = TestBed.inject(ThemeMode);
    buttonByText(page, 'Dark').click();
    expect(mode.choice()).toBe('dark');
    expect(document.documentElement.classList.contains('tb-dark')).toBe(true);
    buttonByText(page, 'Light').click();
    expect(mode.choice()).toBe('light');
  });

  it('shows a dark copy of the colour samples', () => {
    const page = render();
    expect(page.querySelectorAll('tb-gallery-both-themes .tb-dark').length).toBeGreaterThan(0);
  });
});
