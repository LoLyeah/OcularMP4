import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PRESET_JSON_SCHEMA } from '../lib/ai-providers.ts';
import {
  AUDIO_CODECS,
  OUTPUT_FORMATS,
  VIDEO_CODECS,
  resolveFfmpegCodecArgs,
} from '../lib/media-capabilities.ts';

test('shared capability lists include every advertised codec and format', () => {
  assert.ok(VIDEO_CODECS.includes('av1'));
  assert.ok(AUDIO_CODECS.includes('aac'));
  assert.ok(OUTPUT_FORMATS.includes('aac'));
  assert.deepEqual(PRESET_JSON_SCHEMA.properties.settings.properties.vcodec.enum, VIDEO_CODECS);
  assert.deepEqual(PRESET_JSON_SCHEMA.properties.settings.properties.acodec.enum, AUDIO_CODECS);
  assert.deepEqual(PRESET_JSON_SCHEMA.properties.settings.properties.format.enum, OUTPUT_FORMATS);
});

test('manual codec choices replace stale encoder arguments and map WASM fallbacks', () => {
  assert.deepEqual(resolveFfmpegCodecArgs({
    format: 'webm',
    vcodec: 'av1',
    acodec: 'opus',
    audioEnabled: true,
  }, ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-c:a', 'aac']), [
    '-crf',
    '24',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-row-mt',
    '1',
    '-c:a',
    'libopus',
  ]);
});

test('audio and video disable controls resolve to FFmpeg stream flags', () => {
  assert.deepEqual(resolveFfmpegCodecArgs({
    vcodec: 'none',
    acodec: 'none',
    audioEnabled: false,
  }, ['-c:v', 'libx264', '-c:a', 'aac']), ['-vn', '-an']);
});

test('studio controls render directly from shared capability lists', async () => {
  const studio = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(studio, /OUTPUT_FORMAT_OPTIONS\.map/);
  assert.match(studio, /VIDEO_CODEC_OPTIONS/);
  assert.match(studio, /AUDIO_CODEC_OPTIONS/);
});

test('preset workflow keeps single-file import free of duplicate controls', async () => {
  const studio = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const translations = await readFile(new URL('../lib/i18n.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(translations, /Preset for this file/);
  assert.match(studio, /queue\.length > 1 && <details/);
  assert.match(studio, /onSelect=\{\(\) => selectBatchPreset\(preset\)\}/);
  assert.match(studio, /const continueToAdjust = \(\) =>/);
  assert.match(studio, /selectPreset\(selectedJob\?\.preset \|\| batchPreset\)/);
});
