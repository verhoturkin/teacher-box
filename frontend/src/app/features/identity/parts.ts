/**
 * Parts of the identity feature that other features embed: data access, its types and the group picker.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { ChangePasswordForm } from './account/change-password-form';
export { IdentityApi } from './data-access/identity-api';
export { GroupPicker } from './groups/group-picker';
