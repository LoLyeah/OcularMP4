# Encode.Core

Encode.Core is a private, browser-native video and audio converter. Files can be
trimmed and transcoded locally with native browser APIs or FFmpeg.wasm, with
custom presets stored on the device. The interface is available in English and
Bahasa Indonesia.

## Requirements

- Node.js 24
- npm 11
- A provider API key entered in Settings when using cloud AI

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

## AI preset providers

AI presets are user-configured in Settings. Supported providers include OpenAI,
Google Gemini, Groq, Anthropic, OpenRouter, Together AI, Mistral, DeepSeek,
local Ollama, and custom OpenAI-compatible endpoints.

Cloud API keys are submitted only with the current request and are never stored
by the server. Keys remain in session storage by default; users can explicitly
choose to remember a key on their device. Ollama and custom local endpoints are
called directly from the browser.
