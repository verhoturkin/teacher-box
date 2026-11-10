import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import type { Account } from '@features/identity/parts';
import type { Saved } from '@features/settings/setup/steps/setup-state';
import { portalSettings } from './portal-fixtures';
import { lessonRules } from './schedule-fixtures';
import { testProviders } from './setup';

/** The teacher of the first setup. */
export const SETUP_ACCOUNT: Account = {
  id: 'teacher-1',
  role: 'TEACHER',
  displayName: 'Учитель',
  profileName: 'Учитель',
  avatar: null,
  login: 'teacher',
  email: null,
  phone: null,
  passwordChangeRequired: false,
  language: 'ru',
};

/** What the server keeps of a fresh portal: the defaults, no price. */
export function savedSetup(overrides: Partial<Saved> = {}): Saved {
  return {
    account: SETUP_ACCOUNT,
    portal: portalSettings({ setupCompleted: false }),
    zone: 'Europe/Moscow',
    currency: 'RUB',
    locked: false,
    price: 0,
    rules: lessonRules(),
    dueSoon: 1440,
    ...overrides,
  };
}

/** A step or an example of the setup with these inputs, rendered. */
export async function renderStep<C>(
  component: Type<C>,
  inputs: Readonly<Record<string, unknown>>,
): Promise<ComponentFixture<C>> {
  TestBed.configureTestingModule({ providers: testProviders() });
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  return fixture;
}
