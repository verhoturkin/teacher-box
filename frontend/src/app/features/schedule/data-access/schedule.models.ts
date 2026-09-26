export type ScheduleLessonStatus = 'SCHEDULED' | 'CONDUCTED' | 'MISSED' | 'CANCELLED';
export type LessonOutcome = Extract<ScheduleLessonStatus, 'CONDUCTED' | 'MISSED'>;
export type CancelledBy = 'TEACHER' | 'STUDENT';
export type ChangeKind = 'RESCHEDULE' | 'CANCEL';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN' | 'OUTDATED';
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/** Mirrors `RequestView` of the backend. */
export interface ChangeRequest {
  readonly id: string;
  readonly lessonId: string;
  readonly studentId: string;
  readonly studentName: string | null;
  readonly kind: ChangeKind;
  readonly lessonStartsAt: string;
  readonly proposedStartsAt: string | null;
  readonly comment: string | null;
  readonly status: RequestStatus;
  /** A cancellation asked for later than the cancellation policy allows. */
  readonly late: boolean;
  /** The teacher's comment on the decision. */
  readonly answer: string | null;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

/** Mirrors `LessonView` of the backend. */
export interface ScheduledLesson {
  readonly id: string;
  readonly studentId: string;
  readonly studentName: string | null;
  readonly seriesId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly durationMinutes: number;
  readonly topic: string | null;
  readonly meetingUrl: string | null;
  readonly status: ScheduleLessonStatus;
  readonly cancelledBy: CancelledBy | null;
  readonly cancelReason: string | null;
  /** The time the lesson was first planned for, if it moved. */
  readonly originalStartsAt: string | null;
  readonly pendingRequest: ChangeRequest | null;
}

/** Mirrors `SeriesView` of the backend. */
export interface LessonSeries {
  readonly id: string;
  readonly studentId: string;
  readonly studentName: string | null;
  readonly weekdays: Weekday[];
  /** Local time in the instance time zone, `HH:mm:ss`. */
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly intervalWeeks: number;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly topic: string | null;
  readonly meetingUrl: string | null;
}

export interface SeriesPlanned {
  readonly series: LessonSeries;
  /** Lessons created ahead. */
  readonly lessons: number;
}

/** Mirrors `ScheduleSettings` of the backend. */
export interface ScheduleSettings {
  /** Time zone of series and notifications, e.g. `Europe/Moscow`. */
  readonly timeZone: string;
  readonly defaultDurationMinutes: number;
  readonly lateCancellationMinutes: number;
  readonly reminderMinutes: number[];
}

/** Mirrors `FeedView` of the backend. */
export interface CalendarFeed {
  readonly enabled: boolean;
  readonly createdAt: string | null;
  /** Path of the link; only in the response that created it. */
  readonly path: string | null;
}

export interface PlanLessonRequest {
  readonly studentId: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly topic: string | null;
  readonly meetingUrl: string | null;
  readonly allowOverlap: boolean;
}

export interface EditLessonRequest {
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly topic: string | null;
  readonly meetingUrl: string | null;
  readonly allowOverlap: boolean;
}

export interface CancelLessonRequest {
  readonly reason: string | null;
  /** The student asked for the cancellation. */
  readonly byStudent: boolean;
  /** Charge the cancellation as a missed lesson. */
  readonly charge: boolean;
}

export interface SeriesRequest {
  readonly studentId: string;
  readonly weekdays: Weekday[];
  /** `HH:mm` in the instance time zone. */
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly intervalWeeks: number;
  /** First day; for a change — the day the new settings apply from. */
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly topic: string | null;
  readonly meetingUrl: string | null;
  readonly allowOverlap: boolean;
}

export interface ApproveRequest {
  /** New time of a move; defaults to the proposed one. */
  readonly startsAt: string | null;
  readonly charge: boolean;
  readonly answer: string | null;
}

export interface ChangeRequestBody {
  readonly kind: ChangeKind;
  readonly proposedStartsAt: string | null;
  readonly comment: string | null;
}

export type GoogleStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'NEEDS_RECONNECT';

/** Mirrors `GoogleStatusView` of the backend. */
export interface GoogleCalendarStatus {
  readonly clientConfigured: boolean;
  /** The OAuth client is set by environment variables and cannot be changed in the UI. */
  readonly clientFromEnvironment: boolean;
  readonly clientId: string | null;
  readonly status: GoogleStatus;
  readonly busyEnabled: boolean;
  readonly lastError: string | null;
  readonly lastSyncAt: string | null;
  readonly connectedAt: string | null;
  /** Path of the redirect URI to register in Google Cloud. */
  readonly callbackPath: string;
}

/** A time when the teacher is busy in their own Google calendars. */
export interface BusyTime {
  readonly start: string;
  readonly end: string;
}
