export type RecordingKind = "audio" | "video";

/** A recording file the app can open, as `inspect_recording` reports it. */
export interface Recording {
  path: string;
  name: string;
  kind: RecordingKind;
  size: number;
  /** Milliseconds since the Unix epoch. */
  modified_at: number | null;
}
