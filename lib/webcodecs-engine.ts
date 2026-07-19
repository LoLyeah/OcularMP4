import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4BufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmBufferTarget } from 'webm-muxer';
import type { AudioCodec, OutputFormat, VideoCodec } from './media-capabilities';

export interface WebCodecsTranscodeOptions {
  file: File;
  format: OutputFormat;
  vcodec: VideoCodec;
  acodec: AudioCodec;
  fps?: number;
  qualityCrf?: number;
  targetMB?: number | '';
  onProgress?: (progress: number) => void;
}

export function isWebCodecsSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.VideoEncoder !== 'undefined';
}

function resolveVideoCodecString(vcodec: VideoCodec): string {
  switch (vcodec) {
    case 'h264':
      return 'avc1.42E01E';
    case 'hevc':
      return 'hvc1.1.6.L93.B0';
    case 'av1':
      return 'av01.0.08M.08';
    case 'vp9':
      return 'vp09.00.10.08';
    default:
      return 'avc1.42E01E';
  }
}

function resolveAudioCodecString(acodec: AudioCodec): string {
  switch (acodec) {
    case 'aac':
      return 'mp4a.40.2';
    case 'opus':
      return 'opus';
    default:
      return 'mp4a.40.2';
  }
}

export async function transcodeWithWebCodecs(options: WebCodecsTranscodeOptions): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs API is not supported in this browser environment.');
  }

  const { file, format, vcodec, acodec, onProgress } = options;
  const isMp4 = format === 'mp4' || format === 'mkv';

  // 1. Create Video Element & URL
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.src = videoUrl;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load input video file.'));
  });

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  const duration = video.duration || 1;
  const targetFps = options.fps && options.fps > 0 ? options.fps : 30;

  // 2. Setup Muxer
  let mp4Muxer: Mp4Muxer<Mp4BufferTarget> | null = null;
  let webmMuxer: WebmMuxer<WebmBufferTarget> | null = null;

  if (isMp4) {
    mp4Muxer = new Mp4Muxer({
      target: new Mp4BufferTarget(),
      video: {
        codec: vcodec === 'av1' ? 'av1' : vcodec === 'hevc' ? 'hevc' : 'avc',
        width,
        height,
      },
      audio: acodec !== 'none' ? {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48000,
      } : undefined,
      fastStart: 'in-memory',
    });
  } else {
    webmMuxer = new WebmMuxer({
      target: new WebmBufferTarget(),
      video: {
        codec: vcodec === 'av1' ? 'V_AV1' : 'V_VP9',
        width,
        height,
      },
      audio: acodec !== 'none' ? {
        codec: 'A_OPUS',
        numberOfChannels: 2,
        sampleRate: 48000,
      } : undefined,
    });
  }

  // 3. Setup Hardware VideoEncoder
  const codecString = resolveVideoCodecString(vcodec);
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (mp4Muxer) {
        mp4Muxer.addVideoChunk(chunk, meta);
      } else if (webmMuxer) {
        webmMuxer.addVideoChunk(chunk, meta);
      }
    },
    error: (e) => {
      console.error('WebCodecs VideoEncoder Error:', e);
    },
  });

  const bitrate = typeof options.targetMB === 'number' && options.targetMB > 0
    ? Math.round((options.targetMB * 8 * 1024 * 1024) / duration)
    : 5_000_000;

  videoEncoder.configure({
    codec: codecString,
    width,
    height,
    bitrate,
    framerate: targetFps,
  });

  // 4. Frame Capture Loop via OffscreenCanvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  const totalFrames = Math.ceil(duration * targetFps);
  const frameDurationUs = Math.round(1_000_000 / targetFps);

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const currentTime = frameIdx / targetFps;
    video.currentTime = currentTime;
    await new Promise<void>((res) => {
      video.onseeked = () => res();
    });

    ctx.drawImage(video, 0, 0, width, height);
    const timestampUs = Math.round(currentTime * 1_000_000);
    const frame = new VideoFrame(canvas, { timestamp: timestampUs, duration: frameDurationUs });

    videoEncoder.encode(frame, { keyFrame: frameIdx % (targetFps * 2) === 0 });
    frame.close();

    if (onProgress && frameIdx % 5 === 0) {
      onProgress(Math.min(99, Math.round((frameIdx / totalFrames) * 100)));
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();
  URL.revokeObjectURL(videoUrl);

  if (onProgress) onProgress(100);

  // 5. Finalize Buffer
  if (mp4Muxer) {
    mp4Muxer.finalize();
    const buffer = mp4Muxer.target.buffer;
    return new Blob([buffer], { type: 'video/mp4' });
  } else if (webmMuxer) {
    webmMuxer.finalize();
    const buffer = webmMuxer.target.buffer;
    return new Blob([buffer], { type: 'video/webm' });
  }

  throw new Error('WebCodecs muxing failed.');
}
