import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { T } from '@features/homework/i18n/texts';

/** «Задание», «Тест» and, on a phone, «Настройки» of the test. */
export type EditorTab = 'task' | 'quiz' | 'settings';

/** The tabs of the assignment editor: «Задание» and «Тест» (on a phone «Вопросы» and «Настройки»). */
@Component({
  selector: 'tb-editor-tabs',
  imports: [Tabs, TabList, Tab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <p-tabs
      class="tb-tabs tb-editor__tabs"
      [class.tb-tabs--fixed]="compact()"
      [value]="value()"
      (valueChange)="chosen.emit($event)"
    >
      <p-tablist [attr.aria-label]="t.tabs">
        <p-tab value="task">
          <span class="tb-tab-label">
            @if (!compact()) {
              <i class="tb-i tb-i-description" aria-hidden="true"></i>
            }
            {{ t.tabTask }}
          </span>
        </p-tab>
        @if (compact()) {
          <p-tab value="quiz"
            ><span class="tb-tab-label">{{ t.tabQuestions(questions()) }}</span></p-tab
          >
          <p-tab value="settings"
            ><span class="tb-tab-label">{{ t.tabSettings }}</span></p-tab
          >
        } @else {
          <p-tab value="quiz">
            <span class="tb-tab-label">
              <i class="tb-i tb-i-quiz" aria-hidden="true"></i>
              {{ t.tabQuiz(questions()) }}
            </span>
          </p-tab>
        }
      </p-tablist>
    </p-tabs>
  `,
  styles: `
    .tb-editor__tabs {
      display: block;
      margin-block-end: var(--tb-space-4);
    }
  `,
})
export class EditorTabs {
  protected readonly t = T.editor;

  readonly value = input.required<EditorTab>();
  readonly compact = input.required<boolean>();
  /** How many questions the test has. */
  readonly questions = input.required<number>();
  readonly chosen = output<string | number | undefined>();
}
