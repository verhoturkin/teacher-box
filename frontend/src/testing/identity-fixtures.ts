import { Student, StudentGroup } from '@features/identity/data-access/identity.models';

/** A student as the teacher sees it, with overridable fields. */
export function aStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    displayName: 'Мария',
    email: null,
    phone: null,
    note: null,
    status: 'ACTIVE',
    login: 'maria',
    createdAt: '2026-09-01T10:00:00Z',
    version: 0,
    pendingInvite: null,
    ...overrides,
  };
}

/** A current group of students, with overridable fields. */
export function aGroup(overrides: Partial<StudentGroup> = {}): StudentGroup {
  return {
    id: 'group-1',
    name: 'ОГЭ 9 класс',
    members: [
      { id: 'student-1', displayName: 'Мария', status: 'ACTIVE' },
      { id: 'student-2', displayName: 'Борис', status: 'INVITED' },
    ],
    archivedAt: null,
    createdAt: '2026-09-01T10:00:00Z',
    version: 0,
    ...overrides,
  };
}
