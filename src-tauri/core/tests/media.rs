use std::path::Path;

use axe_tabber_core::media::{self, Kind};

#[test]
fn recognizes_audio_and_video_by_extension_in_any_case() {
    assert_eq!(media::kind_of(Path::new("/x/riff.WAV")), Some(Kind::Audio));
    assert_eq!(media::kind_of(Path::new("/x/solo.m4a")), Some(Kind::Audio));
    assert_eq!(media::kind_of(Path::new("/x/lesson.MOV")), Some(Kind::Video));
    assert_eq!(media::kind_of(Path::new("/x/notes.txt")), None);
    assert_eq!(media::kind_of(Path::new("/x/no-extension")), None);
}

#[test]
fn inspect_reports_the_file_and_refuses_other_kinds() {
    let dir = std::env::temp_dir().join(format!("axe-tabber-media-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let take = dir.join("take 1.mp3");
    std::fs::write(&take, b"not really audio").unwrap();
    let text = dir.join("chords.txt");
    std::fs::write(&text, b"G C D").unwrap();

    let rec = media::inspect(&take).unwrap();
    assert_eq!(rec.name, "take 1.mp3");
    assert_eq!(rec.kind, Kind::Audio);
    assert_eq!(rec.size, 16);
    assert!(rec.modified_at.is_some());
    assert!(media::inspect(&text).is_err());
    assert!(media::inspect(&dir.join("missing.wav")).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
}
