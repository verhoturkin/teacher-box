import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { hostElement, readableText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { BackupsPage } from './backups-page';

describe('admin BackupsPage', () => {
  it('puts the backups card of the administrator in a pane', async () => {
    TestBed.configureTestingModule({ imports: [BackupsPage], providers: testProviders() });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BackupsPage);
    fixture.detectChanges();
    backend.expectOne('/api/admin/backups').flush([]);
    await fixture.whenStable();

    const host = hostElement(fixture);
    expect(host.querySelector('tb-pane tb-backups-card')).not.toBeNull();
    expect(readableText(host)).toContain('Копии');
    backend.verify();
  });
});
