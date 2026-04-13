# Nur

Nur is a local-first desktop EPUB reader with offline text-to-speech, voice tools, page translation, and on-device book summaries.

It is built for people who want the convenience of AI-assisted reading without sending their library to the cloud.

![Nur Preview](docs/preview.png)

> Local-first. Private by default. Your books, voices, and reading state stay on your machine.

## What Nur Does

- Imports and reads EPUB books in a desktop library
- Turns books into synchronized local audiobooks
- Highlights the currently spoken sentence during playback
- Supports two local TTS engines:
  - `Piper`: fast, lightweight, and the default engine
  - `Chatterbox`: higher-quality local narration with a longer startup buffer for smoother playback
- Lets you manage reusable voices in Voice Studio
- Saves reading progress, playback state, and reader settings locally
- Translates the current page locally into:
  - Spanish
  - French
  - Arabic
- Plays translated text back with matching local voices
- Generates a local synopsis for books in the library
- Applies reader appearance settings across the wider app UI
- Minimizes to the system tray on supported desktop platforms

## Feature Highlights

### Reading

- Paginated EPUB reader with progress restore
- Auto page turn during playback
- Table of contents navigation
- Reader controls for font size, spacing, typeface, and theme
- Dark, sepia, and light reading themes

### Audio

- Sentence-level highlighting synchronized to narration
- Smooth local playback pipeline with startup buffering for premium narration
- Local voice selection and reusable speaker assets
- Separate default and premium engine paths for speed vs quality

### Translation

- Page-level local translation for supported languages
- Local translated-audio preview
- RTL-aware rendering for Arabic

### Library

- Recent reads and progress indicators
- On-device synopsis generation from EPUB content
- Search and quick resume

### Diagnostics

- Backend/runtime health reporting
- Revealable log files
- Recovery actions for engine/model issues

## Privacy

Nur is designed to run locally. Reading, TTS, translation, and summary generation are intended to happen on-device.

First use of some optional models may download model files to your machine and then cache them locally. After that, playback and reading workflows remain local.

## Architecture

Nur is split into three parts:

1. Electron main process
   Handles the application window, tray behavior, library persistence, IPC, packaging/runtime checks, and backend process management.
2. React renderer
   Renders the library, reader, settings, voice tools, and translation/summary UI.
3. Python backend
   Runs the local TTS, translation, and summary services behind a small FastAPI server.

At runtime the renderer asks Electron for file and app operations, and Electron communicates with the local backend for generation tasks.

## Tech Stack

- Electron
- React
- TypeScript
- Vite / electron-vite
- Tailwind CSS
- FastAPI
- PyTorch-based local model stack
- PyInstaller for packaging the backend

## Repository Layout

```text
src/
  main/        Electron main process
  preload/     Context bridge APIs
  renderer/    React UI
  shared/      Shared TypeScript contracts
nur_backend/
  nur_tts_backend/  FastAPI backend and local AI services
resources/     Packaged runtime assets
scripts/       Build, packaging, smoke, and release scripts
docs/          Project docs and assets
```

## Requirements

For development:

- Node.js 20+
- npm
- Python 3.10 or 3.11

For the best `Chatterbox` experience:

- A capable GPU is strongly recommended
- Windows users will get the best premium-engine performance on a supported NVIDIA setup
- Apple Silicon can use MPS, but premium playback may need longer startup buffering

`Piper` remains the fast default path for lower-end machines.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

If you change the Python backend or need to rebuild the packaged backend runtime:

```bash
npm run backend:prepare
```

## Build Commands

### Standard Build

```bash
npm run build
```

### Packaged Builds

```bash
# Unpacked smoke target
npm run build:unpack

# Windows installer / packaged build
npm run build:win

# macOS build
npm run build:mac

# Linux build
npm run build:linux
```

## Release Validation

Before cutting a release:

```bash
npm run typecheck
npm run release:check
npm run smoke:release
```

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the full manual QA and publishing flow.

## Backend and Model Notes

- `Piper` is the default TTS engine.
- `Chatterbox` is prepared on demand and is intended as the premium local narration option.
- Translation models are loaded locally on first use for supported languages.
- Library summaries currently use a local synopsis pipeline (`local-synopsis-v2`) built from EPUB content extraction and premise detection.
- Downloaded/runtime model assets are cached under the user data directory.

## Current Build / Packaging Notes

- The Python backend must be built on the same platform you want to ship.
- `npm run build:mac` should be run on a real Mac.
- Apple Silicon and Intel macOS builds are handled separately through the current build flow.
- Unsigned builds may trigger platform trust warnings during install or launch.

## Project Status

Nur is currently positioned as a polished local EPUB + TTS desktop app with:

- stable Windows packaging flow
- local premium and fast TTS options
- local translation and local synopsis generation
- release tooling and smoke validation already in the repo

If you are shipping publicly, validate packaged builds on the actual target platform before release.

## Contributing

Contributions are welcome.

If you are working on core runtime features, prefer validating these before opening a PR:

- `npm run typecheck`
- `npm run release:check`
- `npm run smoke:release`

## License

MIT
