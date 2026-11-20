import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { Provider } from '@angular/core';
import { FamilyChild } from '@core/family/family';
import { API_SCOPE } from '@core/http/api-scope';

export const CHILD_ID = '018f0000-0000-7000-8000-0000000000c1';
export const SECOND_CHILD_ID = '018f0000-0000-7000-8000-0000000000c2';

/** A child of `GET /api/guardian/children`. */
export function familyChild(overrides: Partial<FamilyChild> = {}): FamilyChild {
  return {
    id: CHILD_ID,
    displayName: 'Петя Смирнов',
    status: 'ACTIVE',
    avatar: null,
    ...overrides,
  };
}

/** The family scope of one child (`/family/<id>`), as the family route provides it. */
export function familyScopeOf(childId = CHILD_ID): Provider {
  return {
    provide: API_SCOPE,
    useValue: {
      api: signal(`/api/guardian/students/${childId}`).asReadonly(),
      area: signal(`/family/${childId}`).asReadonly(),
      feed: '/api/guardian/schedule/feed',
      readOnly: true,
    },
  };
}

/** The request a navigation's guard sends once the router gets to it (a few ticks later). */
export async function pendingRequest(
  backend: HttpTestingController,
  url: string,
): Promise<TestRequest> {
  for (let tick = 0; tick < 50; tick++) {
    const [request] = backend.match(url);
    if (request !== undefined) {
      return request;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`No request to ${url}`);
}
