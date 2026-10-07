import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { FileOpener, OPENED_URL_TTL_MS } from './file-opener';
import { FileSaver } from './file-saver';

describe('FileOpener', () => {
  let opener: FileOpener;
  let saved: string[];
  let tab: { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    opener = TestBed.inject(FileOpener);
    saved = [];
    vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, name) => {
      saved.push(name);
    });
    tab = { opener: window, location: { href: '' }, close: vi.fn() };
    const fake: unknown = tab;
    if (!isTab(fake)) throw new Error('Not a tab');
    vi.spyOn(window, 'open').mockReturnValue(fake);
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a PDF in the tab opened within the click', () => {
    vi.useFakeTimers();
    const content = new Subject<Blob>();
    opener.open(content, true, () => 'a.pdf');
    expect(window.open).toHaveBeenCalledWith('', '_blank');

    content.next(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(tab.location.href).toBe('blob:pdf');
    expect(tab.opener).toBeNull();
    expect(saved).toEqual([]);
    vi.advanceTimersByTime(OPENED_URL_TTL_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
  });

  it('saves what the browser cannot show and closes the tab', () => {
    opener.open(of(new Blob(['PK'], { type: 'application/msword' })), true, () => 'a.doc');
    expect(tab.close).toHaveBeenCalled();
    expect(saved).toEqual(['a.doc']);

    vi.mocked(window.open).mockClear();
    opener.open(of(new Blob(['PK'])), false, () => 'b.docx');
    expect(window.open).not.toHaveBeenCalled();
    expect(saved).toEqual(['a.doc', 'b.docx']);
  });

  it('closes the tab when the file does not come', () => {
    opener.open(
      throwError(() => new Error('404')),
      true,
      () => 'a.pdf',
    );
    expect(tab.close).toHaveBeenCalled();
    expect(saved).toEqual([]);
  });
});

/** The fake tab has what the opener uses of a window. */
function isTab(value: unknown): value is Window {
  return typeof value === 'object' && value !== null && 'close' in value && 'location' in value;
}
