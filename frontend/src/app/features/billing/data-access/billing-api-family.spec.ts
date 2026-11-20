import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CHILD_ID, familyScopeOf } from '@testing/family-fixtures';
import { testProviders } from '@testing/setup';
import { BillingApi } from './billing-api';

describe('BillingApi in the family cabinet', () => {
  it('reads the child’s payments, summary and receipts through the guardian endpoints', () => {
    TestBed.configureTestingModule({ providers: [...testProviders(), familyScopeOf()] });
    const api = TestBed.inject(BillingApi);
    const backend = TestBed.inject(HttpTestingController);
    const base = `/api/guardian/students/${CHILD_ID}/billing`;

    api.myLedger().subscribe();
    api.mySummary().subscribe();
    api.receipt('p-1', true).subscribe();
    api.receipt('p-1', false).subscribe();

    backend.expectOne(base);
    backend.expectOne(`${base}/summary`);
    backend.expectOne(`${base}/payments/p-1/receipt`);
    backend.expectOne('/api/teacher/billing/payments/p-1/receipt');
    backend.verify();
  });
});
