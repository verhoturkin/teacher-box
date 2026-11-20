import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';
import { CaptionTrack, CaptionTracks, VideoTranscript } from './videos.models';

const VIDEOS = '/api/teacher/textbooks/videos';

/** Captions of YouTube videos for the teacher's materials (ADR-0047); errors are shown by the video tile, not a toast. */
@Injectable({ providedIn: 'root' })
export class VideosApi {
  private readonly http = inject(HttpClient);

  /** The caption tracks of a video to choose from. */
  captions(url: string): Observable<CaptionTracks> {
    return this.http.post<CaptionTracks>(
      `${VIDEOS}/captions`,
      { url },
      { context: quietContext() },
    );
  }

  /** The captions as a transcript: of the chosen track, or without one — of the suggested track (one request). */
  transcript(url: string, track?: CaptionTrack): Observable<VideoTranscript> {
    const body =
      track === undefined ? { url } : { url, language: track.language, automatic: track.automatic };
    return this.http.post<VideoTranscript>(`${VIDEOS}/transcript`, body, {
      context: quietContext(),
    });
  }
}
