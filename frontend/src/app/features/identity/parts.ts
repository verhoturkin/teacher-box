/**
 * Parts of the identity feature that other features embed: data access and its types.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { IdentityApi } from './data-access/identity-api';
export type { Student } from './data-access/identity.models';
