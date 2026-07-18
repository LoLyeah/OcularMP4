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
    const status = candidate.status === 'processing' ? 'interrupted' : candidate.status;
    if (!['queued', 'completed', 'failed', 'cancelled', 'interrupted'].includes(status || '')) return [];
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
