import { UrlMatchResult, UrlMatcher } from '@angular/router';

/**
 * The student's `/cabinet/homework` and `/cabinet/homework/:taskId` are one route: the list stays, the task
 * beside it changes (redesign spec §9); the family cabinet's `/family/:studentId/homework[/:taskId]` too.
 */
export const myHomeworkMatcher: UrlMatcher = (segments): UrlMatchResult | null => {
  const [section, task, ...rest] = segments;
  return section?.path !== 'homework' || rest.length > 0
    ? null
    : task === undefined
      ? { consumed: segments }
      : { consumed: segments, posParams: { taskId: task } };
};
