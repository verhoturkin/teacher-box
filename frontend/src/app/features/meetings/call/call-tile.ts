import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { InitialsPipe } from '@shared/ui/initials';
import { CallParticipant, MediaRef } from './call-engine';

/**
 * One participant of the call: their camera or shared screen, or their initials while the camera is
 * off; the name, a crossed microphone and a weak connection on top. Video elements are always muted:
 * the sound plays through the engine's hidden audio elements.
 */
@Component({
  selector: 'tb-call-tile',
  imports: [InitialsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-call-tile',
    '[class.tb-call-tile--speaking]': 'participant().speaking && !screen()',
    '[class.tb-call-tile--screen]': 'screen()',
    '[attr.aria-label]': 'label()',
    role: 'group',
  },
  template: `
    @if (media()) {
      <video
        #video
        class="tb-call-tile__video"
        [class.tb-call-tile__video--mirror]="participant().local && !screen()"
        autoplay
        playsinline
        [muted]="true"
      ></video>
    } @else {
      <span class="tb-call-tile__avatar" aria-hidden="true">{{
        participant().name | initials
      }}</span>
    }
    <span class="tb-call-tile__name" aria-hidden="true">
      @if (!participant().microphone && !screen()) {
        <i class="pi pi-microphone tb-call-crossed"></i>
      }
      <span class="tb-call-tile__text">{{ caption() }}</span>
      @if (weak()) {
        <i class="pi pi-wifi tb-call-tile__weak"></i>
      }
    </span>
  `,
})
export class CallTile {
  readonly participant = input.required<CallParticipant>();
  /** Shows the shared screen instead of the camera. */
  readonly screen = input(false);

  protected readonly media = computed<MediaRef | null>(() =>
    this.screen() ? this.participant().screen : this.participant().camera,
  );
  protected readonly caption = computed(() => {
    const person = this.participant();
    const name = person.local ? `${person.name} (вы)` : person.name;
    return this.screen() ? `Экран: ${name}` : name;
  });
  protected readonly weak = computed(
    () => this.participant().quality === 'poor' || this.participant().quality === 'lost',
  );
  /** What a screen reader hears for the tile. */
  protected readonly label = computed(() => {
    const parts = [this.caption()];
    if (!this.screen()) {
      parts.push(this.participant().microphone ? 'микрофон включён' : 'микрофон выключен');
      parts.push(this.participant().camera ? 'камера включена' : 'камера выключена');
    }
    if (this.weak()) {
      parts.push('слабая связь');
    }
    return parts.join(', ');
  });

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  constructor() {
    // A new snapshot keeps the same MediaRef for the same track, so this runs only when it changes.
    effect((onCleanup) => {
      const ref = this.media();
      const element = this.video()?.nativeElement;
      if (ref === null || element === undefined) {
        return;
      }
      ref.attach(element);
      onCleanup(() => {
        ref.detach(element);
      });
    });
  }
}
