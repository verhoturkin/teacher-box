import { TestBed } from '@angular/core/testing';
import { FileSaver } from './file-saver';

describe('FileSaver', () => {
  it('downloads a blob through a temporary link', () => {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(`${this.download}|${this.getAttribute('href') ?? ''}`);
    });

    TestBed.inject(FileSaver).save(new Blob(['data']), 'решение.pdf');

    expect(clicked).toEqual(['решение.pdf|blob:test']);
    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.unstubAllGlobals();
  });
});
