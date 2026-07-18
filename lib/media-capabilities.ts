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
  { value: 'hevc', label: 'HEVC', encoder: 'libx265' },
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
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' },
] as const;

export const FRAME_RATE_OPTIONS = [60, 30, 24, 15, 12] as const;

export const VIDEO_BITRATE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '5000k', label: '5 Mbps' },
  { value: '2500k', label: '2.5 Mbps' },
  { value: '1200k', label: '1.2 Mbps' },
  { value: '500k', label: '500 Kbps' },
] as const;

export const OUTPUT_FORMATS = OUTPUT_FORMAT_OPTIONS.map(({ value }) => value);
export const VIDEO_CODECS = VIDEO_CODEC_OPTIONS.map(({ value }) => value);
export const AUDIO_CODECS = AUDIO_CODEC_OPTIONS.map(({ value }) => value);
export const RESOLUTIONS = RESOLUTION_OPTIONS.map(({ value }) => value);

export type OutputFormat = (typeof OUTPUT_FORMAT_OPTIONS)[number]['value'];
export type VideoCodec = (typeof VIDEO_CODEC_OPTIONS)[number]['value'];
export type AudioCodec = (typeof AUDIO_CODEC_OPTIONS)[number]['value'];
export type Resolution = (typeof RESOLUTION_OPTIONS)[number]['value'];

interface ManagedEncodingSettings {
  vcodec: VideoCodec;
  acodec: AudioCodec;
  audioEnabled: boolean;
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

function optionValue(args: string[], flags: Set<string>) {
  const index = args.findIndex((argument) => flags.has(argument));
  return index >= 0 ? args[index + 1] : undefined;
}

export function resolveFfmpegCodecArgs(settings: ManagedEncodingSettings, args: string[]) {
  const video = VIDEO_CODEC_OPTIONS.find(({ value }) => value === settings.vcodec);
  const audio = AUDIO_CODEC_OPTIONS.find(({ value }) => value === settings.acodec);
  const previousVideoEncoder = optionValue(args, VIDEO_FLAGS);
  const codecChanged = Boolean(previousVideoEncoder && previousVideoEncoder !== video?.encoder);

  let resolved = removeFlags(args, new Set([...VIDEO_FLAGS, ...AUDIO_FLAGS]));
  resolved = resolved.filter((argument) => argument !== '-vn' && argument !== '-an');
  if (codecChanged) resolved = removeFlags(resolved, VIDEO_TUNING_FLAGS);

  if (video?.encoder) resolved.push('-c:v', video.encoder);
  else resolved.push('-vn');
  if (codecChanged && settings.vcodec === 'av1') resolved.push('-b:v', '0', '-cpu-used', '6', '-row-mt', '1');
  if (codecChanged && settings.vcodec === 'vp9') resolved.push('-b:v', '0', '-row-mt', '1');
  if (codecChanged && (settings.vcodec === 'h264' || settings.vcodec === 'hevc')) resolved.push('-preset', 'medium');

  if (settings.audioEnabled && audio?.encoder) resolved.push('-c:a', audio.encoder);
  else resolved.push('-an');

  return resolved;
}
