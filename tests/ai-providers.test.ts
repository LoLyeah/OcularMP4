import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePresetData } from '../lib/ai-providers.ts';

test('accepts AV1 presets', () => {
  const preset = {
    name: 'AV1 encode',
    description: 'Efficient AV1 output.',
    category: 'hq',
    ffmpegArgs: ['-c:v', 'libaom-av1', '-crf', '32'],
    settings: {
      format: 'webm',
      vcodec: 'av1',
      acodec: 'opus',
      resolution: '1080p',
      fps: 30,
      vbitrate: 'auto',
      abitrate: '128k',
      audioEnabled: true,
      volume: 1,
    },
  };

  assert.equal(validatePresetData(preset), preset);
});
