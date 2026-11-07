<p align="center">
  <img src="design/icon.png" width="120" alt="Axe Tabber icon">
</p>

<h1 align="center">Axe Tabber</h1>

<p align="center">
  A Mac app that turns an audio or video recording of guitar into tablature.
</p>

## Status

The app shell is in place: open a recording (`⌘O`, or drop it on the window), see its details, and come back to it from the Recent list. Transcription to tablature is not built yet.

## Development

Axe Tabber is a Tauri 2 app with a Rust backend and a React frontend.

### Run it locally

You need Node.js (CI uses version 24), Rust 1.90 or newer, and the Xcode Command Line Tools.

```bash
npm install
npm run app
```

`npm run app` starts a dev build with hot reload.

To work on layout and styling without the native shell, run `npm run dev` and open http://localhost:1420. Outside Tauri, `src/devBridge.ts` stands in for the backend with synthetic recordings.

### Test

```bash
npm run test:core   # settings storage, recording detection
npm run test:app    # the Tauri command layer
npm run lint        # the frontend
```

`npm test` runs only the same tests as `npm run test:app`.

CI runs the tests and the linter on every push to `main` and every pull request. The macOS build runs only when someone comments `/build` on a pull request.

### Build

```bash
npm run bundle
```

The app is written to `src-tauri/target/release/bundle/macos/Axe Tabber.app`.

### Release

```bash
./build-and-publish.sh patch
```

Use `patch`, `minor`, `major` or an exact `x.y.z`. The script bumps the version with `npm version`, commits the bump, builds a signed and notarized `.dmg`, and publishes it as GitHub release `v<version>` along with the files installed copies use to update themselves.

- Without a bump argument, it releases the current version.
- `--no-publish` stops after building and verifying.
- It refuses to run with uncommitted changes, off `main`, or when the tag already exists.
- The version lives only in `package.json`. `src-tauri/tauri.conf.json` reads it from there.

The one-time setup (Developer ID certificate, notarization password and update signing key in the keychain) is described at the top of the script.

### How it works

- `src-tauri/core` (`axe-tabber-core`) holds everything that doesn't need Tauri: settings storage in SQLite and recording detection. Its tests run without the GUI stack.
- `src-tauri/src` is the command layer: the menu, the updater, and the commands the frontend calls.
- `src` is the React frontend. `src/api.ts` lists every backend command.
