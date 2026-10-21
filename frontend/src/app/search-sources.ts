import { Injector, inject } from '@angular/core';
import { map } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { SearchEntry, SearchSource } from '@core/search/search';

const MATERIALS = ['/teacher/materials'];

/** «Мария, группа «ОГЭ»»: the people a board or a textbook is open to, for the second line. */
function members(list: readonly { name: string | null }[]): string | null {
  const names = list.map((member) => member.name).filter((name): name is string => !!name);
  return names.length === 0 ? null : names.join(', ');
}

/**
 * The sources of the global search (redesign spec §2, D6): the lists the teacher's pages already read — students,
 * groups, assignments, boards, textbooks — each with the page that shows the thing. The features are loaded when
 * the search opens, not with the application.
 */
export async function searchSources(): Promise<readonly SearchSource[]> {
  // the injection context ends at the first await
  const injector = inject(Injector);
  const [identityApi, homeworkApi, boardsApi, textbooksApi] = await Promise.all([
    import('@features/identity/parts').then((m) => injector.get(m.IdentityApi)),
    import('@features/homework/parts').then((m) => injector.get(m.HomeworkApi)),
    import('@features/boards/parts').then((m) => injector.get(m.BoardsApi)),
    import('@features/textbooks/parts').then((m) => injector.get(m.TextbooksApi)),
  ]);
  return [
    {
      group: 'students',
      load: () =>
        identityApi.listStudents(quietContext()).pipe(
          map((students) =>
            students
              .filter((student) => student.status !== 'DEACTIVATED')
              .map<SearchEntry>((student) => ({
                id: student.id,
                group: 'students',
                title: student.displayName,
                subtitle: student.email ?? student.login,
                link: ['/teacher/students', student.id],
                keywords: [student.login, student.email, student.phone].filter(
                  (word): word is string => !!word,
                ),
              })),
          ),
        ),
    },
    {
      group: 'groups',
      load: () =>
        identityApi.listGroups(quietContext()).pipe(
          map((groups) =>
            groups
              .filter((group) => group.archivedAt === null)
              .map<SearchEntry>((group) => ({
                id: group.id,
                group: 'groups',
                title: group.name,
                subtitle: members(group.members.map((m) => ({ name: m.displayName }))),
                link: ['/teacher/groups', group.id],
              })),
          ),
        ),
    },
    {
      group: 'assignments',
      load: () =>
        homeworkApi.assignments().pipe(
          map((assignments) =>
            assignments.map<SearchEntry>((assignment) => ({
              id: assignment.id,
              group: 'assignments',
              title: assignment.title,
              subtitle: assignment.students.join(', ') || null,
              link: ['/teacher/homework', assignment.id],
            })),
          ),
        ),
    },
    {
      group: 'boards',
      load: () =>
        boardsApi.list({}, quietContext()).pipe(
          map((list) =>
            list.map<SearchEntry>((board) => ({
              id: board.id,
              group: 'boards',
              title: board.title,
              subtitle: members(board.members),
              // an external board opens on its own site: the search leads to the list of boards
              link: board.kind === 'EXCALIDRAW' ? ['/teacher/boards', board.id] : MATERIALS,
              query: board.kind === 'EXCALIDRAW' ? undefined : { tab: 'boards' },
            })),
          ),
        ),
    },
    {
      group: 'textbooks',
      load: () =>
        textbooksApi.list(quietContext()).pipe(
          map((list) =>
            list.map<SearchEntry>((book) => ({
              id: book.id,
              group: 'textbooks',
              title: book.title,
              subtitle: book.course,
              link: MATERIALS,
              query: { tab: 'textbooks' },
              keywords: [book.filename],
            })),
          ),
        ),
    },
  ];
}
