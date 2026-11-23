/* Videos by link in the teacher's materials (ADR-0047): homework, later lesson plans. */

export type VideoProvider = 'YOUTUBE' | 'RUTUBE' | 'VK' | 'OTHER';

/** A video of a material by link (ADR-0047). */
export interface Video {
  readonly url: string;
  readonly provider: VideoProvider;
  /** The video on its platform; `null` — a plain link opened in a new tab. */
  readonly videoId: string | null;
  /** Where the player starts; `null` — from the beginning. */
  readonly startSeconds: number | null;
  readonly title: string | null;
  /** Lines «[m:ss] text»; `null` — none, or hidden from the student. */
  readonly transcript: string | null;
  /** The student sees the transcript. */
  readonly transcriptShown: boolean;
}

/** A video the teacher gives with a material. */
export interface VideoInput {
  readonly url: string;
  readonly title: string | null;
  readonly transcript: string | null;
  readonly transcriptShown: boolean;
}

/** A caption track of a YouTube video. */
export interface CaptionTrack {
  /** The code of the track: `en`, `ru`… */
  readonly language: string;
  /** Recognized by YouTube, not written by the author. */
  readonly automatic: boolean;
}

/** «Взять субтитры с YouTube»: the caption tracks of a video to choose from. */
export interface CaptionTracks {
  readonly title: string | null;
  /** In YouTube's order, never empty. */
  readonly tracks: readonly CaptionTrack[];
  /** Taken when the teacher does not choose: the author's in the spoken language, else the recognized one. */
  readonly suggested: CaptionTrack;
}

/** «Взять субтитры с YouTube»: the captions as a transcript. */
export interface VideoTranscript {
  readonly title: string | null;
  /** The code of the caption track: `en`, `ru`… */
  readonly language: string;
  /** Recognized by YouTube, not written by the author. */
  readonly automatic: boolean;
  readonly transcript: string;
  /** The end did not fit and is cut off. */
  readonly truncated: boolean;
  /** The video has captions of another track: «Сменить язык» has something to offer. */
  readonly otherTracks: boolean;
}
