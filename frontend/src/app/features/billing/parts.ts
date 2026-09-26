/**
 * Parts of the billing feature that other features embed: widgets, data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { BillingApi } from './data-access/billing-api';
export type { BillingSummary, GroupPrices, MyBillingSummary } from './data-access/billing.models';
export { FinanceWidget } from './home/finance-widget';
export { MyBalanceWidget } from './home/my-balance-widget';
