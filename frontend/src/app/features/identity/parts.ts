/**
 * Parts of the identity feature that other features embed: data access, its types, the account
 * panel with its slot of «Уведомления», the password form, the colours, the tags and the picker of
 * students and groups.
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { AccountNotifications } from './account/account-notifications';
export { AccountPanel } from './account/account-panel';
export { ChangePasswordForm } from './account/change-password-form';
export { ProfilePhoto } from './account/profile-photo';
export { TEACHER_NAME_VALIDATORS, TeacherNameField } from './account/teacher-name-field';
export { ChipColors } from './colors/chip-colors';
export { LabelColorField } from './colors/label-color-field';
export { TeacherColors } from './colors/teacher-colors';
export { IdentityApi } from './data-access/identity-api';
export { TagsPanel } from './tags/tags-panel';
export { MemberPicker } from './groups/member-picker';
export type { MemberSelection, MemberPickerOption } from './groups/member-picker';
export { memberRecipients } from './groups/member-recipients';
export type {
  Account,
  AccountStatus,
  CreatedStudent,
  GroupInput,
  GroupMember,
  InvitePurpose,
  IssuedInvite,
  Student,
  StudentGroup,
  StudentProfileInput,
  StudentTag,
  TagChanged,
  TagValue,
  TagKind,
  TagValueInput,
} from './data-access/identity.models';
