import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Message } from 'primeng/message';
import { Portal } from './portal';
import { AddressWarning, addressWarnings, normalizeAddress } from './portal-address';
import { CORE_T } from '@core/i18n/texts';

/** Explains why students may not reach the portal by the address being entered. */
@Component({
  selector: 'tb-portal-address-warnings',
  imports: [Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (warning of warnings(); track warning) {
      <p-message severity="warn" styleClass="tb-form-message">
        @switch (warning) {
          @case ('local') {
            {{ t.local }}
          }
          @case ('home-network') {
            {{ t.homeNetwork }}
          }
          @case ('unencrypted') {
            {{ t.unencrypted }}
          }
          @case ('elsewhere') {
            {{ t.elsewhere(openedAt, normalized() ?? '') }}
          }
        }
      </p-message>
    }
  `,
})
export class PortalAddressWarnings {
  private readonly portal = inject(Portal);

  /** What the user entered. */
  readonly address = input('');

  protected readonly t = CORE_T.portalAddress;
  protected readonly openedAt = this.portal.openedAt();
  protected readonly normalized = computed(() => normalizeAddress(this.address()));
  protected readonly warnings = computed<AddressWarning[]>(() => {
    const address = this.normalized();
    return address === null ? [] : addressWarnings(address, this.openedAt);
  });
}
