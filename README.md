# Encode.Core

Encode.Core is a private, browser-native video and audio converter. Files can be
trimmed and transcoded locally with native browser APIs or FFmpeg.wasm, with
custom presets stored on the device. The interface is available in English and
Bahasa Indonesia.

## Requirements

- Node.js 24
- npm 11
- Optional `GEMINI_API_KEY` for AI preset generation

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Validate a release

```bash
npm run version:check
npm run validate
```

`validate` runs linting, TypeScript checks, and a production build. The
application version is maintained in `package.json`; update the service-worker
version in `public/sw.js` whenever a release is cut.

## Versioning

Encode.Core follows Semantic Versioning. Use Conventional Commit messages and
tag releases as `vX.Y.Z`. Local settings and custom presets use independent
schema versions so future releases can migrate saved data safely.
