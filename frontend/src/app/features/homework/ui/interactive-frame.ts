import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { InteractiveAnswer, InteractiveResult } from '../data-access/homework.models';

/** Where the pages of interactive homework are served (ADR-0040); nothing else is framed. */
export const INTERACTIVE_PAGE_PATH = '/api/public/homework/interactive/';

/** The limits of the backend (`InteractiveResult`): longer texts are cut, extra answers dropped. */
const MAX_SCORE = 10_000;
const MAX_ANSWERS = 100;
const MAX_QUESTION = 500;
const MAX_ANSWER = 2_000;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 5_000;

/**
 * The page of interactive homework in a sandboxed frame: scripts run, but without the portal's origin. The page talks
 * through the bridge script the backend appends: its height and `teacherbox.result(...)`; messages from anywhere
 * else are ignored.
 */
@Component({
  selector: 'tb-interactive-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (safeUrl(); as src) {
      <iframe
        #frame
        class="tb-interactive-frame"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        [src]="src"
        [title]="title()"
        [style.height.px]="height()"
      ></iframe>
    }
  `,
  styles: `
    .tb-interactive-frame {
      display: block;
      width: 100%;
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-xs);
      /* The page brings its own colours; a light ground keeps a page without them readable. */
      background: var(--p-md-surface-container-lowest);
    }
  `,
})
export class InteractiveFrame {
  private readonly sanitizer = inject(DomSanitizer);

  /** A link from `interactiveLink` / `myInteractiveLink`. */
  readonly url = input.required<string>();
  readonly title = input.required<string>();
  /** Each result the page reports; the last one goes with «Готово». */
  readonly result = output<InteractiveResult>();

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  protected readonly height = signal(480);
  protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.url();
    return url.startsWith(INTERACTIVE_PAGE_PATH)
      ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
      : null;
  });

  constructor() {
    const listener = (event: MessageEvent): void => {
      this.receive(event);
    };
    window.addEventListener('message', listener);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('message', listener);
    });
  }

  private receive(event: MessageEvent): void {
    const own = this.frame()?.nativeElement.contentWindow;
    if (own == null || event.source !== own || !isRecord(event.data)) {
      return;
    }
    const data = event.data;
    if (data['type'] === 'teacherbox:height' && typeof data['height'] === 'number') {
      this.height.set(Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, data['height']))));
    } else if (data['type'] === 'teacherbox:result') {
      const result = interactiveResult(data['result']);
      if (result !== null) {
        this.result.emit(result);
      }
    }
  }
}

/** What a page sent, brought to the shape and limits of the backend; `null` when it is not a result at all. */
export function interactiveResult(value: unknown): InteractiveResult | null {
  if (!isRecord(value)) {
    return null;
  }
  const maxScore = wholeNumber(value['maxScore'], 1, MAX_SCORE);
  const score = maxScore === null ? null : wholeNumber(value['score'], 0, maxScore);
  const answers = Array.isArray(value['answers'])
    ? value['answers'].flatMap((item: unknown) => answer(item)).slice(0, MAX_ANSWERS)
    : [];
  return { score, maxScore: score === null ? null : maxScore, answers };
}

function answer(value: unknown): InteractiveAnswer[] {
  if (!isRecord(value)) {
    return [];
  }
  const question = text(value['question'], MAX_QUESTION);
  if (question === null || question.trim() === '') {
    return [];
  }
  const correct = value['correct'];
  return [
    {
      question,
      answer: text(value['answer'], MAX_ANSWER),
      correct: typeof correct === 'boolean' ? correct : null,
    },
  ];
}

function text(value: unknown, max: number): string | null {
  if (typeof value === 'string') {
    return value.slice(0, max);
  }
  return typeof value === 'number' || typeof value === 'boolean'
    ? String(value).slice(0, max)
    : null;
}

function wholeNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
