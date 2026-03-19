# Release Checklist

## Preflight

- Run `npm run typecheck`
- Run `npm run release:check`
- Run `npm run smoke:release`
- Confirm the worktree is clean apart from intentional release/version changes
- Confirm `nur_backend/__pycache__`, local caches, and generated artifacts are not tracked

## Windows QA

- Install the packaged Windows build on a clean machine
- Confirm first launch reaches the library without engine errors
- Confirm Piper is available by default
- Confirm Chatterbox prepares successfully on a supported GPU
- Import an EPUB and confirm the cover, metadata, and pagination load correctly
- Start, pause, resume, and stop playback with Piper
- Start, pause, resume, and stop playback with Chatterbox
- Confirm the initial Chatterbox buffering UI appears and then transitions into smooth playback
- Confirm auto page turn, progress restore, and reader settings restore after restart
- Confirm tray minimize, reopen-from-tray, and full quit behavior
- Confirm logs can be revealed from the app
- Confirm update check runs without breaking the app

## macOS QA

- Run `npm run build:mac` on actual Apple hardware
- Open the packaged `.app` and confirm the backend starts successfully
- Repeat the same EPUB and playback checks as Windows
- Confirm Finder icon, app name, and file dialogs feel native
- Confirm notarized builds open without Gatekeeper warnings

## Release Ops

- Set Windows signing credentials if you are signing the installer
- Set Apple signing and notarization credentials for macOS builds
- Publish the generated release artifacts to the GitHub release
- Confirm the update metadata is present alongside the uploaded artifacts
- Smoke test auto-update on a machine that installs from the published release

## Final Ship Gate

- Confirm no blocker bugs remain in startup, import, reading, playback, or settings
- Confirm the README matches the current engine names and build flow
- Tag the release commit
- Publish the GitHub release with notes and platform artifacts
