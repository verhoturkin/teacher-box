/**
 * Parts of the identity feature that other features embed: the account, data access, its types and the
 * group picker.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { AccountPanel } from './account/account-panel';
export { ChangePasswordForm } from './account/change-password-form';
export { ChipColors } from './colors/chip-colors';
export { TeacherColors } from './colors/teacher-colors';
export { IdentityApi } from './data-access/identity-api';
export { GroupPicker } from './groups/group-picker';
