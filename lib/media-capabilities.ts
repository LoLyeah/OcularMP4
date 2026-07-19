export const OUTPUT_FORMAT_OPTIONS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
  { value: 'mkv', label: 'MKV' },
  { value: 'gif', label: 'GIF' },
  { value: 'mp3', label: 'MP3' },
  { value: 'aac', label: 'AAC' },
] as const;

export const VIDEO_CODEC_OPTIONS = [
  { value: 'h264', label: 'H.264', encoder: 'libx264' },
  { value: 'vp9', label: 'VP9', encoder: 'libvpx-vp9' },
  { value: 'hevc', label: 'HEVC (H.265)', encoder: 'libx265' },
  { value: 'av1', label: 'AV1', encoder: 'libaom-av1' },
  { value: 'gif', label: 'GIF', encoder: 'gif' },
  { value: 'none', label: 'None', encoder: null },
] as const;

export const AUDIO_CODEC_OPTIONS = [
  { value: 'aac', label: 'AAC', encoder: 'aac' },
  { value: 'opus', label: 'Opus', encoder: 'libopus' },
  { value: 'mp3', label: 'MP3', encoder: 'libmp3lame' },
  { value: 'none', label: 'None', encoder: null },
] as const;

export const RESOLUTION_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: '4k', label: '4K (2160p)' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
] as const;

export const FRAME_RATE_OPTIONS = [0, 60, 30, 24, 15, 12] as const;

export const VIDEO_BITRATE_OPTIONS = [
  { value: 'auto', label: 'Auto (CRF / Quality)' },
  { value: '500k', label: '500 Kbps (Very Small)' },
  { value: '1200k', label: '1.2 Mbps (SD / Mobile)' },
  { value: '2500k', label: '2.5 Mbps (720p Standard)' },
  { value: '5000k', label: '5 Mbps (1080p Standard)' },
  { value: '8000k', label: '8 Mbps (1080p High)' },
  { value: '15000k', label: '15 Mbps (4K Compact)' },
  { value: '25000k', label: '25 Mbps (4K Standard)' },
  { value: '40000k', label: '40 Mbps (4K High)' },
] as const;

export const AUDIO_BITRATE_OPTIONS = [
  { value: 'auto', label: 'Auto (Recommended)' },
  { value: '64k', label: '64 Kbps (Voice / Low)' },
  { value: '96k', label: '96 Kbps (Speech)' },
  { value: '128k', label: '128 Kbps (Standard Stereo)' },
  { value: '160k', label: '160 Kbps (High Quality)' },
  { value: '192k', label: '192 Kbps (HQ Music)' },
  { value: '256k', label: '256 Kbps (Studio Stereo)' },
  { value: '320k', label: '320 Kbps (Maximum Quality)' },
] as const;

export const ENCODE_SPEED_OPTIONS = [
  { value: 'ultrafast', label: 'Ultrafast (Fastest / Low CPU)', preset: 'ultrafast', cpuUsed: '5' },
  { value: 'veryfast', label: 'Veryfast (Faster)', preset: 'veryfast', cpuUsed: '4' },
  { value: 'medium', label: 'Medium (Balanced / Recommended)', preset: 'medium', cpuUsed: '2' },
  { value: 'slow', label: 'Slow (High Efficiency)', preset: 'slow', cpuUsed: '1' },
  { value: 'veryslow', label: 'Veryslow (Max Compression)', preset: 'veryslow', cpuUsed: '0' },
] as const;

export const OUTPUT_FORMATS = OUTPUT_FORMAT_OPTIONS.map(({ value }) => value);
export const VIDEO_CODECS = VIDEO_CODEC_OPTIONS.map(({ value }) => value);
export const AUDIO_CODECS = AUDIO_CODEC_OPTIONS.map(({ value }) => value);
export const RESOLUTIONS = RESOLUTION_OPTIONS.map(({ value }) => value);

export type OutputFormat = (typeof OUTPUT_FORMAT_OPTIONS)[number]['value'];
export type VideoCodec = (typeof VIDEO_CODEC_OPTIONS)[number]['value'];
export type AudioCodec = (typeof AUDIO_CODEC_OPTIONS)[number]['value'];
export type Resolution = (typeof RESOLUTION_OPTIONS)[number]['value'];
export type EncodeSpeed = (typeof ENCODE_SPEED_OPTIONS)[number]['value'];

export function getCompatibleAudioCodecs(format: OutputFormat): AudioCodec[] {
  if (format === 'mp4') return ['aac', 'mp3', 'none'];
  if (format === 'webm') return ['opus', 'none'];
  if (format === 'mp3') return ['mp3'];
  if (format === 'aac') return ['aac'];
  if (format === 'gif') return ['none'];
  return ['aac', 'opus', 'mp3', 'none'];
}

export function getCompatibleVideoCodecs(format: OutputFormat, engine: 'ffmpeg' | 'native' = 'ffmpeg'): VideoCodec[] {
  if (engine === 'ffmpeg') {
    // Standard @ffmpeg/core WASM UMD binary compiles libx264, libvpx-vp9, and gif.
    // libx265 (HEVC) and libaom-av1 (AV1) are omitted in standard WASM builds.
    if (format === 'webm') return ['vp9', 'none'];
    if (format === 'mp4') return ['h264', 'none'];
    if (format === 'gif') return ['gif'];
    if (format === 'mp3' || format === 'aac') return ['none'];
    return ['h264', 'vp9', 'gif', 'none'];
  }
  if (format === 'webm') return ['vp9', 'av1', 'none'];
  if (format === 'mp4') return ['h264', 'hevc', 'av1', 'none'];
  if (format === 'gif') return ['gif'];
  if (format === 'mp3' || format === 'aac') return ['none'];
  return ['h264', 'vp9', 'hevc', 'av1', 'gif', 'none'];
}

export function sanitizeCodecSettings(
  format: OutputFormat,
  vcodec: VideoCodec,
  acodec: AudioCodec,
  engine: 'ffmpeg' | 'native' = 'ffmpeg'
): { vcodec: VideoCodec; acodec: AudioCodec } {
  const validV = getCompatibleVideoCodecs(format, engine);
  const validA = getCompatibleAudioCodecs(format);
  return {
    vcodec: validV.includes(vcodec) ? vcodec : validV[0],
    acodec: validA.includes(acodec) ? acodec : validA[0],
  };
}

export function getVideoBitrateRecommendation(resolution: Resolution, vcodec: VideoCodec): string {
  if (resolution === '4k') {
    return vcodec === 'av1' || vcodec === 'hevc' ? 'Rec: 15 - 25 Mbps' : 'Rec: 25 - 40 Mbps';
  }
  if (resolution === '1080p') {
    return vcodec === 'av1' || vcodec === 'hevc' ? 'Rec: 2.5 - 5 Mbps' : 'Rec: 5 - 8 Mbps';
  }
  if (resolution === '720p') {
    return vcodec === 'av1' || vcodec === 'hevc' ? 'Rec: 1.2 - 2.5 Mbps' : 'Rec: 2.5 - 5 Mbps';
  }
  if (resolution === '480p' || resolution === '360p') {
    return 'Rec: 500 Kbps - 1.2 Mbps';
  }
  return 'Rec: Auto (CRF Quality)';
}

export function getAudioBitrateRecommendation(acodec: AudioCodec, abitrate?: string): string {
  if (acodec === 'none') return 'Audio Muted';
  if (abitrate === 'auto' || !abitrate) {
    if (acodec === 'opus') return 'Rec: Auto (80 - 128 Kbps Opus)';
    if (acodec === 'aac') return 'Rec: Auto (128 - 192 Kbps AAC)';
    if (acodec === 'mp3') return 'Rec: Auto (160 - 320 Kbps MP3)';
    return 'Rec: Auto (Codec default)';
  }
  if (acodec === 'opus') return 'Rec: 80 - 128 Kbps (High Efficiency)';
  if (acodec === 'aac') return 'Rec: 128 - 192 Kbps (Standard Stereo)';
  if (acodec === 'mp3') return 'Rec: 160 - 320 Kbps (HQ MP3)';
  return 'Rec: 128 Kbps';
}

export function calculateBitrateForTargetSize(
  targetMB: number,
  durationSeconds: number,
  audioBitrateKbps: number = 128
): number | null {
  if (targetMB <= 0 || durationSeconds <= 0) return null;
  const totalTargetKilobits = targetMB * 8 * 1024;
  const totalBitrateKbps = totalTargetKilobits / durationSeconds;
  const videoBitrateKbps = Math.max(100, Math.round(totalBitrateKbps - audioBitrateKbps));
  return videoBitrateKbps;
}

interface ManagedEncodingSettings {
  format?: OutputFormat;
  vcodec: VideoCodec;
  acodec: AudioCodec;
  audioEnabled: boolean;
  encodeSpeed?: EncodeSpeed;
}

const VIDEO_FLAGS = new Set(['-c:v', '-codec:v', '-vcodec']);
const AUDIO_FLAGS = new Set(['-c:a', '-codec:a', '-acodec']);
const VIDEO_TUNING_FLAGS = new Set(['-preset', '-cpu-used', '-row-mt']);

function removeFlags(args: string[], flags: Set<string>) {
  const output: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (flags.has(args[index])) {
      index += 1;
      continue;
    }
    output.push(args[index]);
  }
  return output;
}

export function resolveFfmpegCodecArgs(settings: ManagedEncodingSettings, args: string[]) {
  let vcodec = settings.vcodec;
  let acodec = settings.acodec;
  const format = settings.format || 'mp4';
  const speedOpt = ENCODE_SPEED_OPTIONS.find(({ value }) => value === settings.encodeSpeed) || ENCODE_SPEED_OPTIONS[2];

  const sanitized = sanitizeCodecSettings(format, vcodec, acodec, 'ffmpeg');
  vcodec = sanitized.vcodec;
  acodec = sanitized.acodec;

  const video = VIDEO_CODEC_OPTIONS.find(({ value }) => value === vcodec);
  const audio = AUDIO_CODEC_OPTIONS.find(({ value }) => value === acodec);

  // Remove previous codec and tuning flags to prevent option collisions (e.g. -cpu-used with libx264)
  const allCodecFlags = new Set([...VIDEO_FLAGS, ...AUDIO_FLAGS, ...VIDEO_TUNING_FLAGS]);
  let resolved = removeFlags(args, allCodecFlags);
  resolved = resolved.filter((argument) => argument !== '-vn' && argument !== '-an');

  // WASM binary fallback: standard ffmpeg.wasm UMD binary compiles libx264 and libvpx-vp9.
  // It does NOT compile libx265 or libaom-av1.
  let encoderName: string | null | undefined = video?.encoder;
  if (vcodec === 'hevc' || vcodec === 'av1') {
    encoderName = format === 'webm' ? 'libvpx-vp9' : 'libx264';
  }

  if (encoderName) {
    resolved.push('-c:v', encoderName);
    if (encoderName === 'libx264') {
      resolved.push('-preset', speedOpt.preset);
    } else if (encoderName === 'libvpx-vp9') {
      resolved.push('-b:v', '0', '-cpu-used', speedOpt.cpuUsed, '-row-mt', '1');
    }
  } else {
    resolved.push('-vn');
  }

  let audioEncoder: string | null | undefined = audio?.encoder;
  if (format === 'mp4' && acodec === 'opus') {
    audioEncoder = 'aac';
  } else if (format === 'webm' && (acodec === 'aac' || acodec === 'mp3')) {
    audioEncoder = 'libopus';
  }

  if (settings.audioEnabled && audioEncoder) {
    resolved.push('-c:a', audioEncoder);
  } else {
    resolved.push('-an');
  }

  return resolved;
}
