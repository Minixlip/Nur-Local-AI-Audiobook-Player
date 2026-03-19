# Nur — Local AI Audiobook Player

Nur is a desktop app that turns EPUB ebooks into synchronized audiobooks locally, using offline AI Text-to-Speech engines. It focuses on privacy, speed, and a modern glass-style reading experience.

![Nur Preview](docs/preview.png)

> Local-first. No cloud. Your books and voices stay on your machine.

## Features

- Local AI TTS: Coqui XTTS v2 (high quality) + Piper TTS (high speed).
- Voice Studio: Save voice samples and reuse them across books.
- Reader Sync: Highlights the currently spoken sentence in real time.
- Glass UI: Polished, modern interface with a focus on readability.
- Offline & Private: No external calls required for generation.

## Tech Stack

- Electron + React + TypeScript
- Tailwind CSS for UI
- FastAPI + PyTorch backend (packaged with PyInstaller)
- Electron IPC + local HTTP for engine communication

## Architecture

1. Electron main process launches the backend executable (`nur_backend`).
2. The Python server runs on `localhost:8000`.
3. The renderer requests audio per text segment and streams it to the player.

## Demo

- Video: [](https://streamable.com/yxiu7j)

## Local Setup

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Windows
npm run build:win

# macOS (run this on a real Mac; it builds a host-arch backend first, so Apple Silicon produces arm64 and Intel produces x64)
npm run build:mac

# Linux
npm run build:linux
```

For notarized macOS builds, provide either `APPLE_NOTARY_KEYCHAIN_PROFILE` or all of
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` before running `npm run build:mac`.

### Backend Packaging Notes

- The Python TTS backend must be built on the same host platform you want to ship.
- `npm run build:mac` now prepares a Mac-native `nur_engine` bundle before Electron packaging.
- Windows uses the CUDA backend requirements; macOS uses standard PyTorch wheels for CPU/MPS.

## Repository Structure

```
src/
  main/        # Electron main process
  preload/     # Context bridge APIs
  renderer/    # React UI
nur_backend/   # FastAPI + TTS engines
resources/     # Packaged assets (engine, default speaker)
```

## Notes

- XTTS downloads its model on first run (cached in the user directory).
- Piper downloads into the app data folder via the in-app downloader.

## Roadmap

- [ ] Voice sample preview playback
- [ ] Export audiobook chapters
- [ ] Reading analytics and bookmarks

## License

MIT 
