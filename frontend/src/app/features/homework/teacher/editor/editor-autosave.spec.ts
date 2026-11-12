import { Subject } from 'rxjs';
import { assignmentDetails } from '@testing/homework-fixtures';
import { AutosavedDraft, EditorAutosave, EditorWrite } from './editor-autosave';

function draft(canSave = true) {
  const writes: Subject<EditorWrite>[] = [];
  const host = {
    canSave: vi.fn(() => canSave),
    snapshot: vi.fn(() => 'text'),
    write: vi.fn(() => {
      const write = new Subject<EditorWrite>();
      writes.push(write);
      return write;
    }),
    saved: vi.fn(),
    failed: vi.fn(),
  } satisfies AutosavedDraft;
  return { host, writes, autosave: new EditorAutosave(host) };
}

function finish(write: Subject<EditorWrite> | undefined): void {
  write?.next({ assignment: assignmentDetails(), complete: true });
  write?.complete();
}

describe('EditorAutosave', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves after a moment of quiet and remembers what the server has', () => {
    vi.useFakeTimers();
    const { host, writes, autosave } = draft();
    autosave.delay = 100;
    autosave.schedule();
    vi.advanceTimersByTime(99);
    expect(host.write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(autosave.autosaving()).toBe(true);
    finish(writes[0]);
    expect(host.saved).toHaveBeenCalled();
    expect(autosave.pending()).toBe(false);
    expect(autosave.savedAt()).not.toBeNull();
    expect(autosave.differs('text')).toBe(false);
    expect(autosave.differs('more text')).toBe(true);
  });

  it('saves once more after a change during a save, and runs «Выдать» after it instead', () => {
    const { host, writes, autosave } = draft();
    autosave.run();
    autosave.run();
    finish(writes[0]);
    expect(host.write).toHaveBeenCalledTimes(2);
    const give = vi.fn();
    expect(autosave.busy(give)).toBe(true);
    writes[1]?.error(new Error('offline'));
    expect(host.failed).toHaveBeenCalled();
    expect(give).toHaveBeenCalled();
    expect(autosave.busy(give)).toBe(false);
  });

  it('saves nothing the draft does not let it, and nothing once cancelled', () => {
    vi.useFakeTimers();
    const { host, autosave } = draft(false);
    autosave.run();
    autosave.schedule();
    autosave.cancel();
    vi.runAllTimers();
    expect(host.write).not.toHaveBeenCalled();
  });
});
