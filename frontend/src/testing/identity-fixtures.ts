import { Student, StudentGroup, StudentTag } from '@features/identity/data-access/identity.models';

/** A student as the teacher sees it, with overridable fields. */
export function aStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    displayName: 'Мария',
    avatar: null,
    email: null,
    phone: null,
    note: null,
    defaultTopic: null,
    color: null,
    status: 'ACTIVE',
    login: 'maria',
    createdAt: '2026-09-01T10:00:00Z',
    version: 0,
    pendingInvite: null,
    ...overrides,
  };
}

/** A current group of students, with overridable fields. */
export function aTag(overrides: Partial<StudentTag> = {}): StudentTag {
  return {
    id: 'tag-1',
    name: 'Уровень',
    useInAi: true,
    values: [
      { id: 'v-1', label: 'A1' },
      { id: 'v-2', label: 'A2' },
    ],
    version: 0,
    ...overrides,
  };
}

export function aGroup(overrides: Partial<StudentGroup> = {}): StudentGroup {
  return {
    id: 'group-1',
    name: 'ОГЭ 9 класс',
    members: [
      { id: 'student-1', displayName: 'Мария', status: 'ACTIVE' },
      { id: 'student-2', displayName: 'Борис', status: 'INVITED' },
    ],
    defaultTopic: null,
    color: null,
    archivedAt: null,
    createdAt: '2026-09-01T10:00:00Z',
    version: 0,
    ...overrides,
  };
}
