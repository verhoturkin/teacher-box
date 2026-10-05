import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeExcalidraw } from '@testing/excalidraw-fake';
import { EXCALIDRAW_IMPORTS, ExcalidrawLoader, ExcalidrawModules } from './excalidraw-loader';

describe('ExcalidrawLoader', () => {
  function setup(importModules: () => Promise<ExcalidrawModules>): ExcalidrawLoader {
    TestBed.configureTestingModule({
      providers: [{ provide: EXCALIDRAW_IMPORTS, useValue: importModules }],
    });
    return TestBed.inject(ExcalidrawLoader);
  }

  function stylesheets(): HTMLLinkElement[] {
    return [
      ...TestBed.inject(DOCUMENT).head.querySelectorAll<HTMLLinkElement>(
        'link[href="excalidraw.css"]',
      ),
    ];
  }

  /** jsdom does not fetch stylesheets: the test tells the link how it went. */
  async function finishStylesheet(event: 'load' | 'error'): Promise<void> {
    await Promise.resolve();
    stylesheets().forEach((link) => link.dispatchEvent(new Event(event)));
  }

  afterEach(() => {
    stylesheets().forEach((link) => {
      link.remove();
    });
    delete window.EXCALIDRAW_ASSET_PATH;
  });

  it('imports the island once, with its stylesheet and self-hosted fonts', async () => {
    const { modules } = fakeExcalidraw();
    const importModules = vi.fn(() => Promise.resolve(modules));
    const loader = setup(importModules);

    const loading = Promise.all([loader.load(), loader.load()]);
    await finishStylesheet('load');
    const [first, second] = await loading;

    expect(first).toBe(modules);
    expect(second).toBe(modules);
    expect(importModules).toHaveBeenCalledTimes(1);
    expect(stylesheets()).toHaveLength(1);
    expect(stylesheets()[0]?.rel).toBe('stylesheet');
    expect(window.EXCALIDRAW_ASSET_PATH).toBe(new URL('excalidraw-assets/', document.baseURI).href);
  });

  it('retries after a failed import (e.g. the chunk was not reachable)', async () => {
    const { modules } = fakeExcalidraw();
    const importModules = vi
      .fn<() => Promise<ExcalidrawModules>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(modules);
    const loader = setup(importModules);

    const failed = loader.load();
    await finishStylesheet('load');
    await expect(failed).rejects.toThrow('offline');
    await expect(loader.load()).resolves.toBe(modules);
    expect(importModules).toHaveBeenCalledTimes(2);
    expect(stylesheets()).toHaveLength(1);
  });

  it('adds the stylesheet again when it did not load', async () => {
    const { modules } = fakeExcalidraw();
    const loader = setup(() => Promise.resolve(modules));

    const failed = loader.load();
    await finishStylesheet('error');
    await expect(failed).rejects.toThrow('excalidraw.css did not load');
    expect(stylesheets()).toHaveLength(0);

    const retried = loader.load();
    await finishStylesheet('load');
    await expect(retried).resolves.toBe(modules);
  });

  it('uses the real dynamic imports by default', () => {
    expect(TestBed.inject(EXCALIDRAW_IMPORTS)).toBeTypeOf('function');
  });
});
