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

  it('imports the island once and shares it', async () => {
    const { modules } = fakeExcalidraw();
    const importModules = vi.fn(() => Promise.resolve(modules));
    const loader = setup(importModules);

    const [first, second] = await Promise.all([loader.load(), loader.load()]);

    expect(first).toBe(modules);
    expect(second).toBe(modules);
    expect(importModules).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed import (e.g. the chunk was not reachable)', async () => {
    const { modules } = fakeExcalidraw();
    const importModules = vi
      .fn<() => Promise<ExcalidrawModules>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(modules);
    const loader = setup(importModules);

    await expect(loader.load()).rejects.toThrow('offline');
    await expect(loader.load()).resolves.toBe(modules);
    expect(importModules).toHaveBeenCalledTimes(2);
  });

  it('uses the real dynamic imports by default', () => {
    expect(TestBed.inject(EXCALIDRAW_IMPORTS)).toBeTypeOf('function');
  });
});
