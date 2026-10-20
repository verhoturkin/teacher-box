import { GroupInput, StudentGroup } from '../data-access/identity.models';

/** What a saved group sends to be saved again, with a part of it changed. */
export function groupInput(group: StudentGroup, change: Partial<GroupInput>): GroupInput {
  return {
    name: group.name,
    memberIds: group.members.map((member) => member.id),
    defaultTopic: group.defaultTopic,
    color: group.color,
    ...change,
  };
}
