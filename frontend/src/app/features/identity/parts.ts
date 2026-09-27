/**
 * Parts of the identity feature that other features embed: data access, its types and the group picker.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { IdentityApi } from './data-access/identity-api';
export type { GroupMember, Student, StudentGroup } from './data-access/identity.models';
export { GroupPicker } from './groups/group-picker';
