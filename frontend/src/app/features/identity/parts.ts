/**
 * Parts of the identity feature that other features embed: data access, its types, the password form
 * and the group picker. The account panel is in index.ts: it embeds `notifications/parts`, which
 * imports these parts — exporting it here would close an import cycle (NG0919).
 * Pages are loaded lazily through index.ts; keeping them apart keeps them out of other features' bundles.
 */
export { ChangePasswordForm } from './account/change-password-form';
export { ChipColors } from './colors/chip-colors';
export { TeacherColors } from './colors/teacher-colors';
export { IdentityApi } from './data-access/identity-api';
export { TagsPanel } from './tags/tags-panel';
export { MemberPicker } from './groups/member-picker';
export type { MemberSelection, MemberPickerOption } from './groups/member-picker';
export { memberRecipients } from './groups/member-recipients';
export type {
  StudentGroup,
  StudentTag,
  TagChanged,
  TagValue,
  TagValueInput,
} from './data-access/identity.models';
