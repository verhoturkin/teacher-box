import { PortalSettings } from '@core/portal/portal';
import { Account } from '@features/identity/parts';
import { LessonRules } from '@features/schedule/parts';

export type StepId = 'password' | 'portal' | 'time' | 'rules' | 'done';

/** What the teacher has set up so far, as the server keeps it (the start of «Пропустить»). */
export interface Saved {
  readonly account: Account;
  readonly portal: PortalSettings;
  readonly zone: string;
  readonly currency: string;
  readonly locked: boolean;
  /** Minor units. */
  readonly price: number;
  readonly rules: LessonRules;
  readonly dueSoon: number;
}

/** `null` for an empty or missing text. */
export function nonEmpty(text: string | undefined): string | null {
  return text === undefined || text === '' ? null : text;
}
