export interface RecoverableQueueJob {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  error?: string;
}

export interface PreflightCapabilities {
  webAssembly: boolean;
  mediaRecorder: boolean;
  canvasCapture: boolean;
}

export const QUEUE_RECOVERY_KEY = 'ocularmp4.queue-recovery.v1';

function parseBitrate(value: string) {
  if (value === 'auto') return null;
  if (value === 'none') return 0;
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (value.toLowerCase().endsWith('m')) return amount * 1_000_000;
  if (value.toLowerCase().endsWith('k')) return amount * 1_000;
  return amount;
}

export function estimateOutputBytes(options: {
  sourceSize: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  videoBitrate: string;
  audioBitrate: string;
  audioEnabled: boolean;
}) {
  if (options.duration <= 0) return Math.max(1, options.sourceSize);
  const clipEnd = options.trimEnd || options.duration;
  const clipDuration = Math.max(0, clipEnd - options.trimStart);
  const sourceRatio = options.duration > 0 ? Math.min(1, clipDuration / options.duration) : 1;
  const videoBitrate = parseBitrate(options.videoBitrate);
  const audioBitrate = options.audioEnabled ? parseBitrate(options.audioBitrate) : 0;

  if (videoBitrate === null) {
    return Math.max(1, Math.round(options.sourceSize * sourceRatio));
  }

  const totalBitrate = videoBitrate + (audioBitrate || 0);
  return Math.max(1, Math.round((totalBitrate * clipDuration) / 8));
}

export function validateFfmpegArgs(args: string[]) {
  const unsafe = args.find((arg) =>
    arg === '-i'
    || /^(https?|file|pipe|concat):/i.test(arg)
    || ['-filter_script', '-filter_complex_script', '-progress'].includes(arg),
  );
  if (unsafe) throw new Error(`Unsafe FFmpeg argument: ${unsafe}`);
  if (args.length > 100) throw new Error('Too many FFmpeg arguments.');
  return args;
}

export function safeFileStem(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '');
  return withoutExtension
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 80) || 'media';
}

export function createTempNames(fileName: string, format: string, token: string) {
  const inputExtension = fileName.split('.').pop()?.replace(/[^\w]/g, '').slice(0, 10) || 'media';
  const safeToken = token.replace(/[^\w-]/g, '').slice(0, 40) || 'job';
  return {
    inputName: `input-${safeToken}.${inputExtension}`,
    outputName: `output-${safeToken}.${format.replace(/[^\w]/g, '')}`,
    downloadName: `converted_${safeFileStem(fileName)}.${format}`,
  };
}

export function getPreflightIssues(options: {
  capabilities: PreflightCapabilities;
  engine: 'native' | 'ffmpeg';
  queueLength: number;
  fileSize: number;
  args: string[];
}) {
  const issues: string[] = [];
  if (!options.capabilities.webAssembly && options.engine === 'ffmpeg') issues.push('webassembly-unavailable');
  if ((!options.capabilities.mediaRecorder || !options.capabilities.canvasCapture) && options.engine === 'native') issues.push('native-engine-unavailable');
  if (options.queueLength > 1 && options.engine !== 'ffmpeg') issues.push('queue-requires-ffmpeg');
  if (options.fileSize > 2_000_000_000) issues.push('large-file');
  try {
    validateFfmpegArgs(options.args);
  } catch {
    issues.push('unsafe-arguments');
  }
  return issues;
}

export function recoverQueueSnapshot(value: unknown): RecoverableQueueJob[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<RecoverableQueueJob>;
    if (typeof candidate.id !== 'string' || typeof candidate.fileName !== 'string' || typeof candidate.fileSize !== 'number') return [];
    // Only an actively processing job can be interrupted by a reload. Queued
    // metadata from older snapshots must not produce a recovery warning.
    if (candidate.status !== 'processing') return [];
    const status = 'interrupted';
    return [{
      id: candidate.id,
      fileName: candidate.fileName,
      fileSize: candidate.fileSize,
      fileType: typeof candidate.fileType === 'string' ? candidate.fileType : '',
      status: status as RecoverableQueueJob['status'],
      error: candidate.status === 'processing' ? 'Conversion was interrupted by a reload.' : candidate.error,
    }];
  });
}
