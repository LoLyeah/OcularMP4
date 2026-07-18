import assert from 'node:assert/strict';
import test from 'node:test';
import { createTempNames, estimateOutputBytes, getPreflightIssues, recoverQueueSnapshot, safeFileStem, validateFfmpegArgs } from '../lib/conversion-reliability.ts';

test('sanitizes download and temporary filenames', () => {
  assert.equal(safeFileStem('../../My holiday (final).mp4'), 'My_holiday_final');
  assert.deepEqual(createTempNames('My video.mov', 'mp4', 'job:42'), {
    inputName: 'input-job42.mov',
    outputName: 'output-job42.mp4',
    downloadName: 'converted_My_video.mp4',
  });
});

test('rejects unsafe FFmpeg input and network arguments', () => {
  assert.throws(() => validateFfmpegArgs(['-i', 'second.mp4']));
  assert.throws(() => validateFfmpegArgs(['https://example.com/video.mp4']));
  assert.doesNotThrow(() => validateFfmpegArgs(['-c:v', 'libx264', '-crf', '22']));
});

test('reports missing engine capabilities and unsafe queue setup', () => {
  assert.deepEqual(getPreflightIssues({
    capabilities: { webAssembly: false, mediaRecorder: true, canvasCapture: true },
    engine: 'ffmpeg',
    queueLength: 2,
    fileSize: 100,
    args: ['-c:v', 'libx264'],
  }), ['webassembly-unavailable']);
});

test('marks active jobs as interrupted after reload', () => {
  assert.deepEqual(recoverQueueSnapshot([{
    id: 'job-1',
    fileName: 'clip.mp4',
    fileSize: 1000,
    fileType: 'video/mp4',
    status: 'processing',
  }]), [{
    id: 'job-1',
    fileName: 'clip.mp4',
    fileSize: 1000,
    fileType: 'video/mp4',
    status: 'interrupted',
    error: 'Conversion was interrupted by a reload.',
  }]);
});

test('estimates output size from each job bitrate and trim range', () => {
  assert.equal(estimateOutputBytes({
    sourceSize: 50_000_000,
    duration: 100,
    trimStart: 10,
    trimEnd: 30,
    videoBitrate: '1m',
    audioBitrate: '128k',
    audioEnabled: true,
  }), 2_820_000);

  assert.equal(estimateOutputBytes({
    sourceSize: 50_000_000,
    duration: 100,
    trimStart: 10,
    trimEnd: 30,
    videoBitrate: 'auto',
    audioBitrate: '128k',
    audioEnabled: true,
  }), 10_000_000);
});
