//! Recognizes the recordings the app can open.

use std::path::Path;

use anyhow::{Result, bail};
use serde::Serialize;

/// File extensions the Open dialog offers, by kind. Kept in step with the
/// dialog filter in src/lib/recordings.ts.
pub const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "m4a", "aac", "flac", "aif", "aiff", "ogg", "opus"];
pub const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "m4v", "mkv", "webm", "avi"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Audio,
    Video,
}

#[derive(Debug, Clone, Serialize)]
pub struct Recording {
    pub path: String,
    pub name: String,
    pub kind: Kind,
    pub size: u64,
    /// Milliseconds since the Unix epoch.
    pub modified_at: Option<i64>,
}

pub fn kind_of(path: &Path) -> Option<Kind> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    if AUDIO_EXTENSIONS.contains(&ext.as_str()) {
        Some(Kind::Audio)
    } else if VIDEO_EXTENSIONS.contains(&ext.as_str()) {
        Some(Kind::Video)
    } else {
        None
    }
}

pub fn inspect(path: &Path) -> Result<Recording> {
    let Some(kind) = kind_of(path) else {
        bail!("{} isn't an audio or video file this app can open", path.display());
    };
    let meta = std::fs::metadata(path)?;
    if !meta.is_file() {
        bail!("{} isn't a file", path.display());
    }
    let modified_at = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64);
    Ok(Recording {
        path: path.to_string_lossy().into_owned(),
        name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        kind,
        size: meta.len(),
        modified_at,
    })
}
