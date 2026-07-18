# OcularMP4

OcularMP4 is a private, installable media-conversion studio that runs in the
browser. It provides a guided workflow for importing and trimming local media,
choosing or generating an encoding preset, adjusting the output, converting the
file, and downloading the result. The official app is available at
[ocularmp4.netlify.app](https://ocularmp4.netlify.app).

Media conversion happens on the user's device. The app offers a lightweight
browser-native engine for basic WebM video output and an FFmpeg.wasm engine for
format-specific transcoding, audio extraction, GIF creation, and custom FFmpeg
arguments.

## What the app does

- Imports local video and audio files by picker or drag and drop
- Previews browser-supported media and selects a trim range
- Includes five starting presets:
  - H.264 MP4 for compatibility
  - compact VP9 WebM
  - high-quality HEVC MP4
  - looping GIF
  - MP3 audio extraction
- Searches and filters presets by category
- Favorites, duplicates, deletes, imports, and exports custom presets
- Adjusts output format, video codec, resolution, frame rate, bitrate, audio,
  and advanced FFmpeg arguments
- Generates validated encoding presets from natural-language requests using a
  configured AI provider
- Keeps up to 30 AI generations in local history for reuse
- Adds a multi-file conversion queue with per-file presets and trim ranges,
  ordering controls, output-size estimates, retry, cancel, and downloads
- Keeps a private local conversion history with engine, preset, result metadata,
  failure details, and one-click preset reuse
- Detects interrupted queues, runs capability and FFmpeg-argument preflight
  checks, cleans temporary files, and warns before closing active conversions
- Includes a dedicated bilingual wiki guide at `/guide` with workflow,
  engine, preset, queue, privacy, and troubleshooting documentation
- Provides English and Bahasa Indonesia interfaces, light/dark/system themes,
  and reduced-motion support
- Registers as a progressive web app and caches the interface and downloaded
  FFmpeg runtime for later offline use
- Offers an in-app installation action and a safe update prompt when a new
  release is ready

## Conversion engines

OcularMP4 has two distinct processing paths.

| Engine | Implementation | Output behavior | Best for |
| --- | --- | --- | --- |
| Native | Canvas capture and `MediaRecorder` | Always produces VP9 WebM video at the selected resolution, frame rate, and video bitrate | Quick, dependency-free video conversion in a compatible browser |
| FFmpeg.wasm | FFmpeg running in WebAssembly | Uses the selected extension and the preset's FFmpeg arguments | MP4, WebM, MKV, GIF, MP3, AAC, codec control, audio handling, and advanced conversions |

The native engine does not honor the selected container, codec, audio setting,
or custom FFmpeg arguments; its output is WebM video. Load and select
FFmpeg.wasm when the exact preset output matters.

When multiple files are queued, FFmpeg.wasm processes them sequentially using
the preset and trim range saved on each job. The lightweight native engine
remains available for single-file conversions.

FFmpeg is loaded on demand from `unpkg.com` using `@ffmpeg/core` 0.12.6. The
first load therefore requires network access. The service worker caches the
downloaded runtime when the browser permits it.

## Typical workflow

1. Import a local media file and, for previewable video, choose the start and
   end of the clip.
2. Select a built-in, custom, imported, or AI-generated preset.
3. Fine-tune the output settings and FFmpeg arguments.
4. Choose the native engine or load FFmpeg.wasm from **Settings**.
5. Start the conversion, keep the tab open, then download the generated file.

Conversion speed and maximum practical file size depend on the browser,
available memory, CPU, source codec, and selected settings. FFmpeg.wasm runs
in-browser and can be substantially slower than a native desktop FFmpeg build.

## AI-generated presets

AI is optional and only creates preset metadata and FFmpeg arguments. It does
not upload or inspect the imported media file.

Supported providers:

| Provider | Request path |
| --- | --- |
| OpenAI | App server proxy |
| Google Gemini | App server proxy |
| Groq | App server proxy |
| Anthropic | App server proxy |
| OpenRouter | App server proxy |
| Together AI | App server proxy |
| Mistral AI | App server proxy |
| DeepSeek | App server proxy |
| Ollama | Directly from the browser |
| Custom OpenAI-compatible endpoint | Directly from the browser |

Provider, model, endpoint, and API key are configured in **Settings**. Cloud
requests send the prompt and API key through the app's API route for that
request; the server does not persist them. Direct providers are called by the
browser and may require CORS configuration. For Ollama, allow the app's origin
with `OLLAMA_ORIGINS`.

Generated responses are validated against the app's preset schema. Inputs,
outputs, shell commands, pipes, and network URLs are rejected from generated
FFmpeg arguments.

## Privacy and local storage

- Imported files and converted outputs remain in browser memory and are not
  sent to the application server.
- Settings, custom presets, favorites, and AI history are stored in
  `localStorage`.
- API keys use `sessionStorage` by default.
- Enabling **Remember key on this device** moves the provider key to
  `localStorage`.
- Preset exports contain custom presets only and never contain API keys.
- The app has no database or user-account system.

Clearing site data removes saved settings, presets, history, credentials, and
cached offline resources.

## Local development

### Requirements

- Node.js 24
- npm 11
- A modern browser with `MediaRecorder`, canvas capture, WebAssembly, and
  service-worker support

### Start the app

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No server-owned AI credentials are required. Users supply provider credentials
through the app. `.env.example` only documents the optional public `APP_URL`
deployment value.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build:next` | Create the Next.js production build |
| `npm run build` | Build Next.js, package an OpenNext Cloudflare worker, and prepare the Sites bundle |
| `npm start` | Run the built Next.js app |
| `npm run lint` | Run ESLint |
| `npm run test` | Run conversion reliability unit tests |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run validate` | Run lint, typecheck, and the complete production build |
| `npm run version:check` | Verify that version references remain synchronized |

## Deployment

The production build targets Cloudflare through OpenNext. `npm run build`
creates:

- `.next/` — Next.js production output
- `.open-next/` — Cloudflare worker and static assets
- `dist/` — packaged Sites deployment artifact

`wrangler.jsonc` points Cloudflare at `.open-next/worker.js`. Cross-origin
isolation headers are configured in `next.config.ts` for FFmpeg/WebAssembly
compatibility.

## Project structure

```text
app/
  page.tsx                 Main four-step conversion studio
  api/ai/preset/route.ts   Cloud AI preset generation proxy
  api/ai/test/route.ts     Cloud provider connection checks
components/
  settings-panel.tsx       Preferences, AI, processing, and storage controls
lib/
  ai-providers.ts          Provider catalog, request helpers, and preset schema
  preset-workspace.ts      Preset import/export and AI history persistence
  settings.ts              Versioned settings and credential storage
  i18n.ts                  English and Bahasa Indonesia strings
public/
  manifest.json            PWA metadata
  sw.js                    App-shell and FFmpeg runtime caching
```

## Preset files

Preset exports use a versioned JSON envelope:

```json
{
  "schemaVersion": 2,
  "exportedAt": "2026-07-18T00:00:00.000Z",
  "presets": []
}
```

Imports may be a versioned export, an array of presets, or one preset object.
Each preset is validated before being stored, and an import is limited to 100
presets.

## Versioning

The current application version is `1.0.0`. OcularMP4 follows Semantic
Versioning and uses Conventional Commit messages and `vX.Y.Z` release tags.

When releasing a new version, update the version in `package.json` and
`public/sw.js`, then run:

```bash
npm run version:check
npm run validate
```
