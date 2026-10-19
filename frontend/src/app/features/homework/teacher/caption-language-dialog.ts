import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  model,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { RadioButton } from 'primeng/radiobutton';
import { locale } from '@core/i18n/language';
import { SHARED_T } from '@shared/i18n/texts';
import { CaptionTrack, CaptionTracks } from '../data-access/homework.models';
import { T } from '../i18n/texts';

/** The name of a caption language in the interface language: `en` → «английский»; an unknown code stays as is. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames([locale()], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * «Взять субтитры с YouTube» of a video with several caption tracks: the teacher picks one (a basic M3 dialog with a
 * single-select list — radio buttons at the leading edge, the whole tile selects). The suggested track comes first and
 * is checked (a TED talk has dozens of tracks);
 * when a transcript is already written the action is «Заменить» and the dialog says so, instead of a second dialog.
 */
@Component({
  selector: 'tb-caption-language-dialog',
  imports: [FormsModule, Button, Dialog, RadioButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog tb-dialog--short"
      [draggable]="false"
      [focusOnShow]="false"
      (onShow)="focusTitle()"
    >
      <ng-template #header let-labelledBy="ariaLabelledBy">
        <span #title class="p-dialog-title" tabindex="-1" [id]="labelledBy">{{ t.header }}</span>
      </ng-template>
      @if (tracks()) {
        @if (replacing()) {
          <p class="tb-muted tb-caption-language__note">{{ t.replacing }}</p>
        }
        <ul class="tb-list" role="radiogroup" [attr.aria-label]="t.header">
          @for (track of ordered(); track $index) {
            <li
              class="tb-caption-language__item"
              [class.tb-caption-language__item--checked]="$index === selected()"
            >
              <p-radiobutton
                class="tb-caption-language__radio"
                name="caption-track"
                [inputId]="'caption-track-' + $index"
                [value]="$index"
                [ngModel]="selected()"
                (ngModelChange)="selected.set($event)"
              />
              <label class="tb-list__text" [for]="'caption-track-' + $index">
                <span class="tb-list__title">{{ name(track) }}</span>
                <span class="tb-list__supporting">{{
                  track.automatic ? t.automatic : t.author
                }}</span>
              </label>
            </li>
          }
        </ul>
      }
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button [label]="replacing() ? t.replace : t.take" (onClick)="take()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-caption-language__note {
      margin: 0 0 var(--tb-space-4);
    }

    /* The whole tile selects: the label covers it; the radio stays above for its own focus ring. */
    .tb-caption-language__item {
      position: relative;
      cursor: pointer;

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--tb-list-item)
        );
      }

      label {
        cursor: pointer;

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
        }
      }

      .tb-caption-language__radio {
        grid-area: lead;
        position: relative;
        z-index: 1;
      }
    }

    /* Our decision (M3 publishes no role for a selected list tile): secondary container, as selected menu items. */
    .tb-caption-language__item--checked,
    .tb-caption-language__item--checked:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }
  `,
})
export class CaptionLanguageDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.captionLanguage;

  readonly visible = model(false);
  /** The tracks to choose from; the suggested one is checked when they come. */
  readonly tracks = input<CaptionTracks | null>(null);
  /** A transcript is written and will be replaced. */
  readonly replacing = input(false);
  readonly chosen = output<CaptionTrack>();

  /** The suggested track first, then the others in YouTube's order. */
  protected readonly ordered = computed(() => {
    const found = this.tracks();
    if (found === null) {
      return [];
    }
    const suggested = found.suggested;
    return [
      suggested,
      ...found.tracks.filter(
        (track) => track.language !== suggested.language || track.automatic !== suggested.automatic,
      ),
    ];
  });
  /** The index in `ordered`; back to the suggested track when new tracks come. */
  protected readonly selected = linkedSignal({ source: this.tracks, computation: () => 0 });
  protected readonly title = viewChild<ElementRef<HTMLElement>>('title');

  protected focusTitle(): void {
    this.title()?.nativeElement.focus();
  }

  protected name(track: CaptionTrack): string {
    const name = languageName(track.language);
    return name.charAt(0).toLocaleUpperCase(locale()) + name.slice(1);
  }

  protected take(): void {
    const track = this.ordered()[this.selected()];
    if (track !== undefined) {
      this.chosen.emit(track);
    }
    this.visible.set(false);
  }
}
