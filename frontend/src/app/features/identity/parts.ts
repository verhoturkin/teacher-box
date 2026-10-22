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
export { MemberPicker } from './groups/member-picker';
export type { MemberSelection, MemberPickerOption } from './groups/member-picker';
export { memberRecipients } from './groups/member-recipients';
export type { StudentGroup } from './data-access/identity.models';
