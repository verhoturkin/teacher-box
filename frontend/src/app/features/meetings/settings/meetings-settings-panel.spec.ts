import { ComponentFixture, TestBed } from '@angular/core/testing';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { MeetingPreferences } from '../telemost';
import { MeetingsSettingsPanel } from './meetings-settings-panel';
import { testProviders } from '@testing/setup';

describe('MeetingsSettingsPanel', () => {
  let fixture: ComponentFixture<MeetingsSettingsPanel>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MeetingsSettingsPanel],
      providers: testProviders(),
    });
    fixture = TestBed.createComponent(MeetingsSettingsPanel);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('explains the links and keeps the desktop application choice on the device', async () => {
    expect(readableText(hostElement(fixture))).toContain('строка «Видеовстреча»');
    expect(readableText(hostElement(fixture))).not.toContain('Яндекс');

    fixture.componentInstance.setOpenInApp(false);
    await fixture.whenStable();

    expect(TestBed.inject(MeetingPreferences).openInApp()).toBe(false);
    expect(
      requireElement(hostElement(fixture), '#meetings-open-in-app', HTMLInputElement).checked,
    ).toBe(false);
  });
});
