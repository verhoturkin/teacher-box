import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { hostElement } from '@testing/dom';
import { BlobImage } from './blob-image';

@Component({
  imports: [BlobImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-blob-image
    [loader]="loader"
    [ref]="ref()"
    [version]="version()"
    icon="tb-i-co_present"
  />`,
})
class Host {
  readonly ref = signal<string | null>('b-1');
  readonly version = signal<string | null>('v1');
  loader: (ref: string) => Observable<Blob> = () => of(new Blob(['png']));
}

describe('BlobImage', () => {
  let fixture: ComponentFixture<Host>;
  let host: HTMLElement;
  let created: ReturnType<typeof vi.spyOn>;
  let revoked: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one');
    revoked = vi.spyOn(URL, 'revokeObjectURL');
    fixture = TestBed.createComponent(Host);
    host = hostElement(fixture);
  });

  it('shows the fetched picture and frees its URL when the picture changes and on destroy', async () => {
    await fixture.whenStable();
    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:one');
    expect(host.querySelector('.tb-i')).toBeNull();

    fixture.componentInstance.version.set('v2');
    await fixture.whenStable();
    expect(revoked).toHaveBeenCalledWith('blob:one');
    expect(created).toHaveBeenCalledTimes(2);

    fixture.destroy();
    expect(revoked).toHaveBeenCalledTimes(2);
  });

  it('shows the icon while loading, without a ref and when the fetch fails', async () => {
    const pending = new Subject<Blob>();
    fixture.componentInstance.loader = () => pending;
    await fixture.whenStable();
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.tb-i-co_present')).not.toBeNull();

    fixture.componentInstance.ref.set(null);
    await fixture.whenStable();
    expect(host.querySelector('.tb-i-co_present')).not.toBeNull();
    expect(pending.observed).toBe(false);

    fixture.componentInstance.loader = () => throwError(() => new Error('404'));
    fixture.componentInstance.ref.set('b-2');
    await fixture.whenStable();
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.tb-i-co_present')).not.toBeNull();
  });
});
