import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Message } from 'primeng/message';
import { Portal } from './portal';
import { AddressWarning, addressWarnings, normalizeAddress } from './portal-address';

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
            Этот адрес открывается только на компьютере, где работает портал. Ученики по нему не
            зайдут.
          }
          @case ('home-network') {
            Это адрес домашней сети: по нему зайдут только из этой сети. Ученикам нужен адрес,
            который открывается из интернета.
          }
          @case ('unencrypted') {
            Адрес без https: пароли будут передаваться незашифрованными. Лучше настроить https.
          }
          @case ('elsewhere') {
            Сейчас портал открыт по адресу {{ openedAt }}. Проверьте, что {{ normalized() }} тоже
            открывается.
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

  protected readonly openedAt = this.portal.openedAt();
  protected readonly normalized = computed(() => normalizeAddress(this.address()));
  protected readonly warnings = computed<AddressWarning[]>(() => {
    const address = this.normalized();
    return address === null ? [] : addressWarnings(address, this.openedAt);
  });
}
