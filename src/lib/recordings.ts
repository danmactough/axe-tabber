import { open } from "@tauri-apps/plugin-dialog";

// Kept in step with AUDIO_EXTENSIONS and VIDEO_EXTENSIONS in src-tauri/core/src/media.rs.
const AUDIO = ["wav", "mp3", "m4a", "aac", "flac", "aif", "aiff", "ogg", "opus"];
const VIDEO = ["mp4", "mov", "m4v", "mkv", "webm", "avi"];

/** Shows the Open dialog; resolves to the chosen path, or null when cancelled. */
export async function chooseRecording(): Promise<string | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    title: "Open a recording",
    filters: [
      { name: "Audio and video", extensions: [...AUDIO, ...VIDEO] },
      { name: "Audio", extensions: AUDIO },
      { name: "Video", extensions: VIDEO },
    ],
  });
  return typeof picked === "string" ? picked : null;
}
