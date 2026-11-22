import { StudentGroup } from '../data-access/identity.models';
import { MemberSelection } from './member-picker';

/** Resolve a snapshot without losing the provenance of explicit individual choices; courses are not resolved here. */
export function memberRecipients(
  selected: readonly MemberSelection[],
  groups: readonly StudentGroup[],
  available: readonly string[],
): string[] {
  const allowed = new Set(available);
  const ids = selected.flatMap((member) => {
    if (member.kind === 'STUDENT') return [member.id];
    if (member.kind === 'COURSE') return [];
    const group = groups.find((group) => group.id === member.id && group.archivedAt === null);
    return (group?.members ?? [])
      .filter((student) => student.status !== 'DEACTIVATED')
      .map((student) => student.id);
  });
  return [...new Set(ids)].filter((id) => allowed.has(id));
}
