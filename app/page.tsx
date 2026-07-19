'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Cpu, Download, FileVideo, FolderOpen, Layers3, Menu,
  Heart, History, Pencil, Search, Settings2, ShieldCheck, Sparkles, Tag, Trash2, Upload, Volume2, VolumeX,
  Wand2, X, Pause, Play, RotateCcw
} from 'lucide-react';
import { translations, type Locale, type TranslationKey } from '../lib/i18n';
import { generateDirectPreset, getAIProvider } from '../lib/ai-providers';
import { DEFAULT_SETTINGS, readAICredential, readSettings, writeSettings, type AppSettings } from '../lib/settings';
import {
  AI_HISTORY_STORAGE_KEY, CONVERSION_HISTORY_STORAGE_KEY, PRESETS_STORAGE_KEY, parseImportedPresets, readAIHistory,
  readConversionHistory, readStoredPresets, writeAIHistory, writeConversionHistory, writeStoredPresets,
  type AIHistoryItem, type ConversionHistoryItem, type Preset, type PresetSettings,
} from '../lib/preset-workspace';
import { SettingsPanel } from '../components/settings-panel';
import {
  QUEUE_RECOVERY_KEY, createTempNames, estimateOutputBytes, getPreflightIssues, recoverQueueSnapshot, validateFfmpegArgs,
  type RecoverableQueueJob,
} from '../lib/conversion-reliability';
import {
  AUDIO_CODEC_OPTIONS,
  FRAME_RATE_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  RESOLUTION_OPTIONS,
  VIDEO_BITRATE_OPTIONS,
  VIDEO_CODEC_OPTIONS,
  resolveFfmpegCodecArgs,
} from '../lib/media-capabilities';

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'fast-compatible',
    name: 'Quick compatibility share',
    description: 'Fast H.264 MP4 for sharing on most platforms.',
    category: 'compatible',
    ffmpegArgs: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k'],
    settings: { format: 'mp4', vcodec: 'h264', acodec: 'aac', resolution: '720p', fps: 30, vbitrate: 'auto', abitrate: '128k', audioEnabled: true, volume: 1 },
  },
  {
    id: 'tiny-chat',
    name: 'Small but HQ',
    description: 'Compact 720p AV1 and Opus WebM that preserves strong visual quality.',
    category: 'size',
    ffmpegArgs: ['-c:v', 'libaom-av1', '-crf', '34', '-b:v', '0', '-cpu-used', '6', '-row-mt', '1', '-vf', 'scale=-2:720', '-r', '24', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-b:a', '80k', '-vbr', 'on'],
    settings: { format: 'webm', vcodec: 'av1', acodec: 'opus', resolution: '720p', fps: 24, vbitrate: 'auto', abitrate: '80k', audioEnabled: true, volume: 1 },
  },
  {
    id: 'discord-25mb',
    name: 'Discord 25 MB',
    description: 'Discord-ready MP4 capped at 24 MB for upload headroom; long clips may be truncated.',
    category: 'size',
    ffmpegArgs: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-vf', 'scale=-2:720', '-r', '30', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-fs', '24M'],
    settings: { format: 'mp4', vcodec: 'h264', acodec: 'aac', resolution: '720p', fps: 30, vbitrate: 'auto', abitrate: '96k', audioEnabled: true, volume: 1 },
  },
  {
    id: 'hq-cinema',
    name: 'HQ cinematic',
    description: 'High-detail HEVC encode with efficient compression.',
    category: 'hq',
    ffmpegArgs: ['-c:v', 'libx265', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k'],
    settings: { format: 'mp4', vcodec: 'hevc', acodec: 'aac', resolution: '1080p', fps: 30, vbitrate: 'auto', abitrate: '192k', audioEnabled: true, volume: 1 },
  },
  {
    id: 'av1-efficient',
    name: 'Efficient AV1 encode',
    description: 'High-efficiency AV1 and Opus WebM with a faster browser-friendly encode.',
    category: 'hq',
    ffmpegArgs: ['-c:v', 'libaom-av1', '-crf', '32', '-b:v', '0', '-cpu-used', '6', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-b:a', '128k'],
    settings: { format: 'webm', vcodec: 'av1', acodec: 'opus', resolution: '1080p', fps: 30, vbitrate: 'auto', abitrate: '128k', audioEnabled: true, volume: 1 },
  },
  {
    id: 'efficient-less-compatible',
    name: 'Efficient but less Compatibility',
    description: 'Quality-focused AV1 and Opus WebM with maximum efficiency but slower encoding and reduced playback support.',
    category: 'hq',
    ffmpegArgs: ['-c:v', 'libaom-av1', '-crf', '28', '-b:v', '0', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on'],
    settings: { format: 'webm', vcodec: 'av1', acodec: 'opus', resolution: '1080p', fps: 30, vbitrate: 'auto', abitrate: '96k', audioEnabled: true, volume: 1 },
  },
  {
    id: 'gif-animator',
    name: 'Looping GIF',
    description: 'Palette-optimized GIF for short social clips.',
    category: 'gif',
    ffmpegArgs: ['-vf', 'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-loop', '0'],
    settings: { format: 'gif', vcodec: 'gif', acodec: 'none', resolution: '480p', fps: 12, vbitrate: 'auto', abitrate: 'none', audioEnabled: false, volume: 1 },
  },
  {
    id: 'audio-only',
    name: 'Clean audio extraction',
    description: 'Extract a clean MP3 audio track from video.',
    category: 'audio',
    ffmpegArgs: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'],
    settings: { format: 'mp3', vcodec: 'none', acodec: 'mp3', resolution: 'original', fps: 30, vbitrate: 'auto', abitrate: '192k', audioEnabled: true, volume: 1 },
  },
  {
    id: 'opus-audio',
    name: 'Opus audio encode',
    description: 'Efficient audio-only Opus encode in a WebM container.',
    category: 'audio',
    ffmpegArgs: ['-vn', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-compression_level', '10'],
    settings: { format: 'webm', vcodec: 'none', acodec: 'opus', resolution: 'original', fps: 30, vbitrate: 'auto', abitrate: '128k', audioEnabled: true, volume: 1 },
  },
];

const categories: Array<'all' | Preset['category']> = ['all', 'compatible', 'size', 'hq', 'audio', 'gif', 'custom'];
const categoryKey: Record<string, TranslationKey> = { all: 'all', compatible: 'compatible', size: 'small', hq: 'quality', audio: 'audio', gif: 'gif', custom: 'custom' };
type QueueStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
interface QueueJob {
  id: string;
  file: File;
  preset: Preset;
  duration: number;
  trimStart: number;
  trimEnd: number;
  status: QueueStatus;
  progress: number;
  outputUrl?: string;
  outputName?: string;
  outputSize?: string;
  error?: string;
  presetOverridden?: boolean;
}
function getMimeType(format: string) {
  return ({ mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif', mp3: 'audio/mpeg', aac: 'audio/aac', mkv: 'video/x-matroska' } as Record<string, string>)[format] || 'application/octet-stream';
}

function getBitrateValue(value: string) {
  if (value === 'auto') return 2_500_000;
  const amount = Number.parseInt(value, 10) || 0;
  if (value.endsWith('m')) return amount * 1_000_000;
  if (value.endsWith('k')) return amount * 1_000;
  return amount;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

let idCounter = 0;
function uniqueId(prefix: string) {
  idCounter += 1;
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${new Date().getTime()}-${idCounter}`;
  return `${prefix}-${random}`;
}

export default function PresetStudio() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [locale, setLocale] = useState<Locale>('en');
  const [panel, setPanel] = useState<'guide' | 'settings' | null>(null);
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [recoveredJobs, setRecoveredJobs] = useState<RecoverableQueueJob[]>([]);
  const cancelQueueRef = useRef(false);
  const pauseQueueRef = useRef(false);
  const [queuePaused, setQueuePaused] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [aiHistory, setAiHistory] = useState<AIHistoryItem[]>([]);
  const [conversionHistory, setConversionHistory] = useState<ConversionHistoryItem[]>([]);
  const [showConversionHistory, setShowConversionHistory] = useState(false);
  const conversionHistoryRef = useRef<ConversionHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset>(DEFAULT_PRESETS[0]);
  const [batchPreset, setBatchPreset] = useState<Preset>(DEFAULT_PRESETS[0]);
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [query, setQuery] = useState('');
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [ffmpeg, setFfmpeg] = useState<any>(null);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegError, setFfmpegError] = useState('');
  const [engine, setEngine] = useState<'native' | 'ffmpeg'>('native');
  const [transcoding, setTranscoding] = useState(false);
  const [conversionStage, setConversionStage] = useState<'preparing' | 'loadingEngine' | 'encoding' | 'finalizing'>('preparing');
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState('');
  const [outputName, setOutputName] = useState('');
  const [outputSize, setOutputSize] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>(['Native browser engine ready.']);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetImportRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const t = (key: TranslationKey) => translations[locale][key];
  const reduceMotion = settings.motion === 'reduced' || (settings.motion === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionProps = reduceMotion
    ? { initial: false, transition: { duration: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12, ease: 'easeOut' as const } };
  const collapseProps = reduceMotion
    ? { initial: false, transition: { duration: 0 } }
    : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.16, ease: 'easeOut' as const } };

  const [customFormat, setCustomFormat] = useState<PresetSettings['format']>(activePreset.settings.format);
  const [customVcodec, setCustomVcodec] = useState<PresetSettings['vcodec']>(activePreset.settings.vcodec);
  const [customAcodec, setCustomAcodec] = useState<PresetSettings['acodec']>(activePreset.settings.acodec);
  const [customResolution, setCustomResolution] = useState<PresetSettings['resolution']>(activePreset.settings.resolution);
  const [customFps, setCustomFps] = useState(activePreset.settings.fps);
  const [customVbitrate, setCustomVbitrate] = useState(activePreset.settings.vbitrate);
  const [customAudioEnabled, setCustomAudioEnabled] = useState(activePreset.settings.audioEnabled);
  const [customArgs, setCustomArgs] = useState(activePreset.ffmpegArgs.join(' '));
  const configuredPreset = useMemo<Preset>(() => ({
    ...activePreset,
    ffmpegArgs: customArgs.split(/\s+/).filter(Boolean),
    settings: {
      ...activePreset.settings,
      format: customFormat,
      vcodec: customVcodec,
      acodec: customAcodec,
      resolution: customResolution,
      fps: customFps,
      vbitrate: customVbitrate,
      audioEnabled: customAudioEnabled,
    },
  }), [activePreset, customAcodec, customArgs, customAudioEnabled, customFormat, customFps, customResolution, customVbitrate, customVcodec]);

  const updateVideoCodec = (vcodec: PresetSettings['vcodec']) => {
    setCustomVcodec(vcodec);
    setCustomArgs((current) => resolveFfmpegCodecArgs({
      vcodec,
      acodec: customAcodec,
      audioEnabled: customAudioEnabled,
    }, current.split(/\s+/).filter(Boolean)).join(' '));
  };

  const updateAudioCodec = (acodec: PresetSettings['acodec']) => {
    setCustomAcodec(acodec);
    setCustomArgs((current) => resolveFfmpegCodecArgs({
      vcodec: customVcodec,
      acodec,
      audioEnabled: customAudioEnabled && acodec !== 'none',
    }, current.split(/\s+/).filter(Boolean)).join(' '));
    if (acodec === 'none') setCustomAudioEnabled(false);
  };

  const updateAudioEnabled = () => {
    const audioEnabled = !customAudioEnabled;
    setCustomAudioEnabled(audioEnabled);
    setCustomArgs((current) => resolveFfmpegCodecArgs({
      vcodec: customVcodec,
      acodec: customAcodec,
      audioEnabled,
    }, current.split(/\s+/).filter(Boolean)).join(' '));
  };
  const nativeMode = engine === 'native';
  const nativeSourceUnsupported = Boolean(selectedFile?.type.startsWith('audio/'));
  const effectiveFormat = nativeMode && !nativeSourceUnsupported ? 'webm' : configuredPreset.settings.format;
  const effectiveVideoCodec = nativeMode && !nativeSourceUnsupported ? 'vp9' : configuredPreset.settings.vcodec;
  const effectiveAudio = nativeMode && !nativeSourceUnsupported ? false : configuredPreset.settings.audioEnabled;
  const exactEngineRecommended = nativeMode && (
    configuredPreset.settings.format !== 'webm'
    || configuredPreset.settings.vcodec !== 'vp9'
    || configuredPreset.settings.audioEnabled
    || queue.length > 1
    || nativeSourceUnsupported
  );
  const outputSummary = nativeMode && nativeSourceUnsupported ? [
    configuredPreset.settings.format.toUpperCase(),
    t('ffmpegRequired'),
  ].join(' · ') : [
    effectiveFormat.toUpperCase(),
    effectiveVideoCodec === 'none' ? t('audio') : effectiveVideoCodec.toUpperCase(),
    configuredPreset.settings.resolution,
    `${configuredPreset.settings.fps} FPS`,
    effectiveAudio ? configuredPreset.settings.acodec.toUpperCase() : t('videoOnly'),
  ].join(' · ');

  useEffect(() => {
    if (!selectedJobId || step === 1) return;
    setQueue((current) => current.map((job) => job.id === selectedJobId ? { ...job, preset: configuredPreset } : job));
  }, [configuredPreset, selectedJobId, step]);

  useEffect(() => {
    if (!panel) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || []);
    const timer = window.setTimeout(() => focusable()[0]?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [panel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readSettings();
      setSettings(stored);
      setLocale(stored.locale);
      setEngine(stored.defaultEngine);
      try {
        setPresets(readStoredPresets(DEFAULT_PRESETS));
        setAiHistory(readAIHistory());
        const storedConversions = readConversionHistory();
        conversionHistoryRef.current = storedConversions;
        setConversionHistory(storedConversions);
        setRecoveredJobs(recoverQueueSnapshot(JSON.parse(localStorage.getItem(QUEUE_RECOVERY_KEY) || '[]')));
      } catch { /* preserve defaults when storage is invalid */ }
      setSettingsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const updateConnection = () => setIsOnline(navigator.onLine);
    const updateDisplayMode = () => setIsStandalone(standalone.matches);
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      const activeLocale: Locale = document.documentElement.lang === 'id' ? 'id' : 'en';
      setToast(translations[activeLocale].appInstalled);
    };

    updateConnection();
    updateDisplayMode();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    standalone.addEventListener('change', updateDisplayMode);
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    let swRegistration: ServiceWorkerRegistration | null = null;
    let updateTimer: number | undefined;
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') void swRegistration?.update();
    };
    const watchInstallingWorker = () => {
      const worker = swRegistration?.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateWorker(worker);
        }
      });
    };
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', checkForUpdate);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
        swRegistration = registration;
        if (registration.waiting) setUpdateWorker(registration.waiting);
        registration.addEventListener('updatefound', watchInstallingWorker);
        void registration.update();
        updateTimer = window.setInterval(checkForUpdate, 15 * 60 * 1000);
      }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
      standalone.removeEventListener('change', updateDisplayMode);
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('focus', checkForUpdate);
      document.removeEventListener('visibilitychange', checkForUpdate);
      if (updateTimer) window.clearInterval(updateTimer);
      swRegistration?.removeEventListener('updatefound', watchInstallingWorker);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.motion = settings.motion;
    writeSettings({ ...settings, locale });
  }, [locale, settings, settingsReady]);

  useEffect(() => {
    if (!settingsReady) return;
    // Only persist an active conversion. A merely queued file is not an
    // interrupted job, and its File object cannot be restored after reload.
    const snapshot = queue.filter((job) => job.status === 'processing').map((job) => ({
      id: job.id,
      fileName: job.file.name,
      fileSize: job.file.size,
      fileType: job.file.type,
      status: job.status,
      error: job.error,
    }));
    if (snapshot.length) localStorage.setItem(QUEUE_RECOVERY_KEY, JSON.stringify(snapshot));
    else if (!transcoding) localStorage.removeItem(QUEUE_RECOVERY_KEY);
  }, [queue, settingsReady, transcoding]);

  useEffect(() => {
    if (!transcoding) return;
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeClose);
    return () => window.removeEventListener('beforeunload', warnBeforeClose);
  }, [transcoding]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredPresets = useMemo(() => presets.filter((preset) => {
    const matchesCategory = category === 'all' || preset.category === category;
    const needle = query.toLowerCase().trim();
    return matchesCategory && (!needle || `${preset.name} ${preset.description} ${preset.category} ${(preset.tags || []).join(' ')}`.toLowerCase().includes(needle));
  }), [category, presets, query]);
  const showingRecommended = category === 'all' && !query.trim() && !showAllPresets;
  const visiblePresets = showingRecommended ? filteredPresets.slice(0, 3) : filteredPresets;

  const persistPresets = (next: Preset[]) => {
    setPresets(next);
    writeStoredPresets(next, DEFAULT_PRESETS);
  };

  const toggleFavorite = (preset: Preset) => {
    persistPresets(presets.map((item) => item.id === preset.id ? { ...item, favorite: !item.favorite } : item));
  };

  const deletePreset = (preset: Preset) => {
    if (DEFAULT_PRESETS.some((base) => base.id === preset.id)) return;
    persistPresets(presets.filter((item) => item.id !== preset.id));
    if (activePreset.id === preset.id) selectPreset(DEFAULT_PRESETS[0]);
    setToast(t('presetDeleted'));
  };

  const duplicatePreset = (preset: Preset) => {
    const copy: Preset = { ...preset, id: uniqueId('copy'), name: `${preset.name} · Copy`, source: 'custom', favorite: false };
    persistPresets([...presets, copy]);
    selectPreset(copy);
    setToast(t('presetDuplicated'));
  };

  const renamePreset = (preset: Preset) => {
    const name = window.prompt(t('renamePresetPrompt'), preset.name)?.trim();
    if (!name || name === preset.name) return;
    const next = presets.map((item) => item.id === preset.id ? { ...item, name } : item);
    persistPresets(next);
    if (activePreset.id === preset.id) setActivePreset({ ...activePreset, name });
    setToast(t('presetRenamed'));
  };

  const editPresetTags = (preset: Preset) => {
    const value = window.prompt(t('tagsPrompt'), (preset.tags || []).join(', '));
    if (value === null) return;
    const tags = [...new Set(value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
    persistPresets(presets.map((item) => item.id === preset.id ? { ...item, tags } : item));
    setToast(t('tagsUpdated'));
  };

  const exportPresets = () => {
    const payload = { schemaVersion: 2, exportedAt: new Date().toISOString(), presets: presets.filter((item) => !DEFAULT_PRESETS.some((base) => base.id === item.id)) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ocularmp4-presets-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(t('presetsExported'));
  };

  const importPresets = async (file?: File) => {
    if (!file) return;
    try {
      const imported = parseImportedPresets(await file.text());
      persistPresets([...presets, ...imported]);
      setToast(t('presetsImported'));
    } catch (error: any) {
      setToast(error?.message || t('importFailed'));
    }
  };

  const selectPreset = (preset: Preset) => {
    setActivePreset(preset);
    setCustomFormat(preset.settings.format);
    setCustomVcodec(preset.settings.vcodec);
    setCustomAcodec(preset.settings.acodec);
    setCustomResolution(preset.settings.resolution);
    setCustomFps(preset.settings.fps);
    setCustomVbitrate(preset.settings.vbitrate);
    setCustomAudioEnabled(preset.settings.audioEnabled);
    setCustomArgs(preset.ffmpegArgs.join(' '));
  };

  const selectBatchPreset = (preset: Preset) => {
    setBatchPreset(preset);
    selectPreset(preset);
    setQueue((current) => current.map((job) => job.presetOverridden ? job : { ...job, preset }));
  };

  const log = (message: string) => setLogs((items) => [...items.slice(-80), `[${new Date().toLocaleTimeString()}] ${message}`]);

  const recordConversion = (item: Omit<ConversionHistoryItem, 'id' | 'createdAt'>) => {
    const next: ConversionHistoryItem[] = [{ ...item, id: uniqueId('conversion'), createdAt: new Date().toISOString() }, ...conversionHistoryRef.current].slice(0, 50);
    conversionHistoryRef.current = next;
    setConversionHistory(next);
    writeConversionHistory(next);
  };

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    if (patch.locale) setLocale(patch.locale);
    if (patch.defaultEngine) setEngine(patch.defaultEngine);
  };

  const selectQueueJob = (job: QueueJob) => {
    const file = job.file;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(file);
    setSelectedJobId(job.id);
    setSelectedFile(file);
    setFileUrl(url);
    setOutputUrl('');
    setOutputName('');
    setDuration(job.duration);
    setTrimStart(job.trimStart);
    setTrimEnd(job.trimEnd);
    selectPreset(job.preset);
    setStep(0);
    log(`Selected ${file.name}`);
  };

  const addFiles = (files: File[] | FileList) => {
    const incoming = Array.from(files).filter((file) => file.type.startsWith('video/') || file.type.startsWith('audio/'));
    if (!incoming.length) return;
    const jobs: QueueJob[] = incoming.map((file) => ({
      id: uniqueId('job'),
      file,
      preset: batchPreset,
      duration: 0,
      trimStart: 0,
      trimEnd: 0,
      status: 'queued',
      progress: 0,
    }));
    setQueue((current) => [...current, ...jobs]);
    setRecoveredJobs((current) => current.filter((job) => !incoming.some((file) => file.name === job.fileName && file.size === job.fileSize)));
    if (!selectedFile) selectQueueJob(jobs[0]);
    setToast(`${incoming.length} ${t('filesAdded')}`);
  };

  const handleFile = (file?: File) => {
    if (file) addFiles([file]);
  };

  const handleMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const length = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
    setDuration(length);
    const selectedJob = queue.find((job) => job.id === selectedJobId);
    const nextEnd = selectedJob?.trimEnd || length;
    setTrimEnd(nextEnd);
    if (selectedJobId) {
      setQueue((current) => current.map((job) => job.id === selectedJobId ? {
        ...job,
        duration: length,
        trimEnd: job.trimEnd || length,
      } : job));
    }
  };

  const selectAndContinue = () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const continueToAdjust = () => {
    const selectedJob = queue.find((job) => job.id === selectedJobId);
    selectPreset(selectedJob?.preset || batchPreset);
    setStep(2);
  };

  const loadFFmpeg = async () => {
    if (ffmpeg) return;
    setFfmpegLoading(true);
    setConversionStage('loadingEngine');
    setFfmpegError('');
    try {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
      const instance = new FFmpeg();
      instance.on('progress', ({ progress: value }: { progress: number }) => setProgress(Math.min(99, Math.round(value * 100))));
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await instance.load({ coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm') });
      setFfmpeg(instance);
      setEngine('ffmpeg');
      setConversionStage('preparing');
      log('FFmpeg.wasm compiler loaded from CDN.');
      setToast(t('compilerLoaded'));
    } catch (error: any) {
      setFfmpegError(error?.message || 'Unable to load FFmpeg.');
      log(`FFmpeg error: ${error?.message || 'unknown error'}`);
    } finally {
      setFfmpegLoading(false);
    }
  };

  const generatePreset = async () => {
    if (!aiPrompt.trim()) return;
    const provider = getAIProvider(settings.aiProvider);
    const apiKey = readAICredential(settings.aiProvider);
    if (provider.requiresKey && !apiKey) {
      setAiError(t('apiKeyRequired'));
      setPanel('settings');
      return;
    }
    setAiGenerating(true);
    setAiError('');
    log(`AI preset request via ${provider.name} (${settings.aiModel}).`);
    try {
      let presetData;
      if (provider.direct) {
        presetData = await generateDirectPreset({
          provider: settings.aiProvider,
          endpoint: settings.aiEndpoint,
          model: settings.aiModel,
          apiKey,
          prompt: aiPrompt,
          locale,
        });
      } else {
        const response = await fetch('/api/ai/preset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: settings.aiProvider,
            model: settings.aiModel,
            apiKey,
            prompt: aiPrompt,
            locale,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Preset generation failed.');
        presetData = data.preset;
      }
      const generated: Preset = { ...presetData, id: uniqueId('ai'), category: 'custom', source: 'ai', tags: ['ai'] };
      const next = [...presets, generated];
      persistPresets(next);
      const historyItem: AIHistoryItem = { id: uniqueId('history'), prompt: aiPrompt, provider: provider.name, model: settings.aiModel, createdAt: new Date().toISOString(), preset: { ...generated } };
      const nextHistory = [historyItem, ...aiHistory].slice(0, 30);
      setAiHistory(nextHistory);
      writeAIHistory(nextHistory);
      selectBatchPreset(generated);
      setAiPrompt('');
      setToast(t('presetSaved'));
      log(`AI preset created with ${provider.name}.`);
    } catch (error: any) {
      setAiError(error?.message || t('error'));
      log(`AI provider error: ${error?.message || 'unknown error'}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const saveCustomPreset = () => {
    const custom: Preset = {
      id: uniqueId('custom'),
      name: `${activePreset.name} · Custom`,
      description: `Custom ${customFormat.toUpperCase()} configuration.`,
      category: 'custom',
      ffmpegArgs: customArgs.split(/\s+/).filter(Boolean),
      settings: { ...activePreset.settings, format: customFormat, vcodec: customVcodec, acodec: customAcodec, resolution: customResolution, fps: customFps, vbitrate: customVbitrate, audioEnabled: customAudioEnabled },
      source: 'custom',
    };
    const customOnly = [...presets.filter((item) => !DEFAULT_PRESETS.some((base) => base.id === item.id)), custom];
    persistPresets([...DEFAULT_PRESETS, ...customOnly]);
    selectPreset(custom);
    setToast(t('presetSaved'));
  };

  const transcodeFile = async (workingFile: File, job?: QueueJob) => {
    const jobId = job?.id;
    const jobPreset = job?.preset || configuredPreset;
    const jobDuration = job?.duration || duration;
    const jobTrimStart = job?.trimStart ?? trimStart;
    const jobTrimEnd = job?.trimEnd || jobDuration;
    const jobSettings = jobPreset.settings;
    setProgress(0);
    setOutputUrl('');
    const started = Date.now();
    const temporaryFiles: string[] = [];
    try {
      setConversionStage('preparing');
      if (engine === 'ffmpeg') {
        if (!ffmpeg) throw new Error('Load FFmpeg.wasm first.');
        const { fetchFile } = await import('@ffmpeg/util');
        const names = createTempNames(workingFile.name, jobSettings.format, jobId || uniqueId('single'));
        const inputName = names.inputName;
        const output = names.outputName;
        temporaryFiles.push(inputName, output);
        await ffmpeg.writeFile(inputName, await fetchFile(workingFile));
        const encodingArgs = resolveFfmpegCodecArgs(jobSettings, jobPreset.ffmpegArgs);
        const args = ['-ss', jobTrimStart.toFixed(3), '-to', jobTrimEnd.toFixed(3), '-i', inputName, ...encodingArgs, output];
        setConversionStage('encoding');
        await ffmpeg.exec(args);
        setConversionStage('finalizing');
        const data = await ffmpeg.readFile(output);
        const blob = new Blob([data], { type: getMimeType(jobSettings.format) });
        const resultUrl = URL.createObjectURL(blob);
        setOutputUrl(resultUrl);
        const outputFileName = names.downloadName;
        setOutputName(outputFileName);
        setOutputSize(formatBytes(blob.size));
        if (jobId) setQueue((current) => current.map((item) => item.id === jobId ? { ...item, status: 'completed', progress: 100, outputUrl: resultUrl, outputName: outputFileName, outputSize: formatBytes(blob.size) } : item));
        recordConversion({ fileName: workingFile.name, outputName: outputFileName, outputSize: formatBytes(blob.size), status: 'completed', engine, presetName: jobPreset.name, preset: jobPreset });
      } else {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) throw new Error('Preview canvas unavailable.');
        const width = jobSettings.resolution === '1080p' ? 1920 : jobSettings.resolution === '720p' ? 1280 : jobSettings.resolution === '480p' ? 854 : jobSettings.resolution === '360p' ? 640 : video.videoWidth;
        const height = jobSettings.resolution === '1080p' ? 1080 : jobSettings.resolution === '720p' ? 720 : jobSettings.resolution === '480p' ? 480 : jobSettings.resolution === '360p' ? 360 : video.videoHeight;
        canvas.width = width || 1280;
        canvas.height = height || 720;
        const stream = canvas.captureStream(jobSettings.fps);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: getBitrateValue(jobSettings.vbitrate) });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
        const finished = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            setConversionStage('finalizing');
            const blob = new Blob(chunks, { type: 'video/webm' });
            const resultUrl = URL.createObjectURL(blob);
            setOutputUrl(resultUrl);
            const outputFileName = `converted_${workingFile.name.replace(/\.[^/.]+$/, '')}.webm`;
            setOutputName(outputFileName);
            setOutputSize(formatBytes(blob.size));
            if (jobId) setQueue((current) => current.map((item) => item.id === jobId ? { ...item, status: 'completed', progress: 100, outputUrl: resultUrl, outputName: outputFileName, outputSize: formatBytes(blob.size) } : item));
            recordConversion({ fileName: workingFile.name, outputName: outputFileName, outputSize: formatBytes(blob.size), status: 'completed', engine, presetName: jobPreset.name, preset: jobPreset });
            resolve();
          };
        });
        video.currentTime = jobTrimStart;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        setConversionStage('encoding');
        recorder.start();
        await video.play();
        const draw = () => {
          if (video.currentTime < jobTrimEnd) {
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            setProgress(Math.min(99, Math.round(((video.currentTime - jobTrimStart) / Math.max(0.1, jobTrimEnd - jobTrimStart)) * 100)));
            requestAnimationFrame(draw);
          } else {
            video.pause();
            recorder.stop();
          }
        };
        requestAnimationFrame(draw);
        await finished;
      }
      setProgress(100);
      setElapsed(Number(((Date.now() - started) / 1000).toFixed(1)));
      if (!jobId || queue.length <= 1) {
        setStep(3);
        setToast(t('complete'));
      }
    } catch (error: any) {
      const cancelled = cancelQueueRef.current;
      if (jobId) setQueue((current) => current.map((item) => item.id === jobId ? { ...item, status: cancelled ? 'cancelled' : 'failed', error: cancelled ? undefined : error?.message || t('error') } : item));
      recordConversion({ fileName: workingFile.name, status: cancelled ? 'cancelled' : 'failed', engine, presetName: jobPreset.name, preset: jobPreset, error: cancelled ? undefined : error?.message || t('error') });
      if (!cancelled) setToast(error?.message || t('error'));
    } finally {
      if (ffmpeg && temporaryFiles.length) {
        await Promise.all(temporaryFiles.map((file) => ffmpeg.deleteFile(file).catch(() => undefined)));
      }
    }
  };

  const handleTranscode = async () => {
    if (!selectedFile || !videoRef.current) return;
    const jobs: QueueJob[] = queue.length ? queue : [{
      id: uniqueId('job'),
      file: selectedFile,
      preset: configuredPreset,
      duration,
      trimStart,
      trimEnd: trimEnd || duration,
      status: 'queued',
      progress: 0,
    }];
    const issues = getPreflightIssues({
      capabilities: {
        webAssembly: typeof WebAssembly !== 'undefined',
        mediaRecorder: typeof MediaRecorder !== 'undefined',
        canvasCapture: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
      },
      engine,
      queueLength: jobs.length,
      fileSize: Math.max(...jobs.map((job) => job.file.size)),
      args: [],
    });
    const issueMessages: Record<string, TranslationKey> = {
      'webassembly-unavailable': 'preflightWebAssembly',
      'native-engine-unavailable': 'preflightNative',
      'queue-requires-ffmpeg': 'queueNeedsFfmpeg',
      'large-file': 'preflightLargeFile',
      'unsafe-arguments': 'preflightUnsafeArgs',
    };
    if (issues.length) {
      setToast(t(issueMessages[issues[0]] || 'error'));
      return;
    }
    try {
      jobs.forEach((job) => validateFfmpegArgs(job.preset.ffmpegArgs));
    } catch {
      setToast(t('preflightUnsafeArgs'));
      return;
    }
    setTranscoding(true);
    cancelQueueRef.current = false;
    pauseQueueRef.current = false;
    setQueuePaused(false);
    if (!queue.length) setQueue(jobs);
    for (const job of jobs) {
      if (cancelQueueRef.current) break;
      if (job.status === 'completed') continue;
      while (pauseQueueRef.current && !cancelQueueRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (cancelQueueRef.current) break;
      setQueue((current) => current.map((item) => item.id === job.id ? { ...item, status: 'processing', progress: 0, error: undefined } : item));
      setSelectedFile(job.file);
      await transcodeFile(job.file, job);
    }
    setTranscoding(false);
    if (!cancelQueueRef.current) {
      setProgress(100);
      setStep(3);
      setToast(queue.length > 1 ? t('queueComplete') : t('complete'));
    }
  };

  const cancelQueue = () => {
    cancelQueueRef.current = true;
    pauseQueueRef.current = false;
    setQueuePaused(false);
    setQueue((current) => current.map((job) => job.status === 'queued' || job.status === 'processing' ? { ...job, status: 'cancelled' } : job));
    if (ffmpeg) {
      ffmpeg.terminate();
      setFfmpeg(null);
      setEngine('native');
    }
    setTranscoding(false);
  };

  const toggleQueuePause = () => {
    pauseQueueRef.current = !pauseQueueRef.current;
    setQueuePaused(pauseQueueRef.current);
  };

  const retryJob = (job: QueueJob) => {
    setQueue((current) => current.map((item) => item.id === job.id ? { ...item, status: 'queued', progress: 0, error: undefined } : item));
    setToast(t('jobQueued'));
  };

  const updateJobPreset = (job: QueueJob, presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    setQueue((current) => current.map((item) => item.id === job.id ? { ...item, preset, presetOverridden: true } : item));
    if (selectedJobId === job.id) selectPreset(preset);
  };

  const clearJobPresetOverride = (job: QueueJob) => {
    setQueue((current) => current.map((item) => item.id === job.id ? { ...item, preset: batchPreset, presetOverridden: false } : item));
    if (selectedJobId === job.id) selectPreset(batchPreset);
  };

  const moveJob = (jobId: string, direction: -1 | 1) => {
    setQueue((current) => {
      const index = current.findIndex((job) => job.id === jobId);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const getJobEstimate = (job: QueueJob) => formatBytes(estimateOutputBytes({
    sourceSize: job.file.size,
    duration: job.duration,
    trimStart: job.trimStart,
    trimEnd: job.trimEnd,
    videoBitrate: job.preset.settings.vcodec === 'none' ? 'none' : job.preset.settings.vbitrate,
    audioBitrate: job.preset.settings.abitrate,
    audioEnabled: job.preset.settings.audioEnabled,
  }));

  const removeJob = (job: QueueJob) => {
    if (job.outputUrl) URL.revokeObjectURL(job.outputUrl);
    setQueue((current) => current.filter((item) => item.id !== job.id));
    if (selectedFile === job.file) {
      setSelectedJobId(null);
      setSelectedFile(null);
      setFileUrl('');
    }
  };

  const clearCompletedJobs = () => {
    queue.filter((job) => job.status === 'completed').forEach((job) => job.outputUrl && URL.revokeObjectURL(job.outputUrl));
    if (queue.some((job) => job.id === selectedJobId && job.status === 'completed')) {
      setSelectedJobId(null);
      setSelectedFile(null);
      setFileUrl('');
    }
    setQueue((current) => current.filter((job) => job.status !== 'completed'));
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  };

  const applyAppUpdate = () => {
    updateWorker?.postMessage({ type: 'SKIP_WAITING' });
  };

  const steps = [t('importStep'), t('presetStep'), t('adjustStep'), t('exportStep')];

  return (
    <main id="main-content" tabIndex={-1} aria-busy={transcoding} className="app-shell relative min-h-screen overflow-hidden bg-transparent text-slate-100">
      <a href="#studio-content" className="sr-only z-50 rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-[#0b1020] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">{t('skipToContent')}</a>
      <div aria-hidden="true" className="app-aurora app-aurora-one pointer-events-none absolute rounded-full" />
      <div aria-hidden="true" className="app-aurora app-aurora-two pointer-events-none absolute rounded-full" />
      <div className="app-container mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="app-header sticky top-3 z-20 mb-7 flex items-center justify-between rounded-2xl border border-white/10 bg-[#111a30]/90 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="app-brand flex items-center gap-3">
            <Image src="/logo-mark.svg" alt="" width={40} height={40} priority className="app-logo h-10 w-10 rounded-xl" />
            <div>
              <div className="font-semibold tracking-tight text-white">{t('appName')}</div>
              <div className="hidden text-xs text-slate-400 sm:block">{t('appTagline')}</div>
            </div>
          </div>
          <nav className="app-nav hidden items-center gap-1 md:flex" aria-label="Primary">
            <span aria-current="page" className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white">{t('studio')}</span>
            <Link href="/guide" className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"><CircleHelp className="mr-1.5 inline h-4 w-4" />{t('guide')}</Link>
          </nav>
          <div className="app-actions flex items-center gap-2">
            <div role="group" className="hidden items-center rounded-lg border border-white/10 bg-black/20 p-0.5 sm:flex" aria-label={t('language')}>
              {(['en', 'id'] as Locale[]).map((item) => <button key={item} aria-pressed={locale === item} onClick={() => updateSettings({ locale: item })} className={`min-h-11 min-w-11 rounded-md px-2 py-1 text-xs font-semibold ${locale === item ? 'bg-cyan-300 text-[#0b1020]' : 'text-slate-400'}`}>{item.toUpperCase()}</button>)}
            </div>
            {!isStandalone && installPrompt && <button onClick={installApp} className="hidden items-center justify-center gap-2 rounded-xl border border-cyan-300/25 px-3 py-2.5 text-xs font-semibold leading-none text-cyan-100 hover:bg-cyan-300/10 sm:inline-flex"><Download className="h-4 w-4 shrink-0" />{t('installApp')}</button>}
            <button onClick={() => setPanel('settings')} aria-label={t('settings')} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 text-slate-300 transition hover:border-cyan-300/50 hover:text-white"><Settings2 className="h-5 w-5" /></button>
            <Link href="/guide" className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 text-slate-300 md:hidden" aria-label={t('guide')}><Menu className="h-5 w-5" /></Link>
          </div>
        </header>

        <AnimatePresence>
        {!isStandalone && installPrompt && <motion.section {...collapseProps} className="mb-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/5 sm:hidden">
          <div className="flex flex-col gap-3 p-4">
          <div><div className="text-sm font-semibold text-white">{t('installApp')}</div><p className="mt-1 text-xs leading-5 text-slate-400">{t('installAppBody')}</p></div>
          <button onClick={installApp} className="rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-semibold text-[#0b1020]"><Download className="mr-1.5 inline h-4 w-4" />{t('installApp')}</button>
          </div>
        </motion.section>}
        </AnimatePresence>

        <section className="workspace-layout mb-7 grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="workflow-rail hidden rounded-2xl border border-white/10 bg-[#111a30] p-3 lg:block">
            <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('workflow')}</div>
            <div className="space-y-1">
              {steps.map((label, index) => <button key={label} aria-current={step === index ? 'step' : undefined} onClick={() => index <= step && setStep(index)} className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${step === index ? 'text-[#0b1020]' : index < step ? 'text-cyan-200 hover:bg-white/5' : 'text-slate-500'}`}>{step === index && <motion.span layoutId="active-workflow-step" className="absolute inset-0 rounded-xl bg-cyan-300" transition={reduceMotion ? { duration: 0 } : { duration: .16, ease: 'easeOut' }} />}<span className={`relative grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step === index ? 'bg-[#0b1020] text-cyan-200' : index < step ? 'bg-cyan-300/15 text-cyan-200' : 'bg-white/5'}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span><span className="relative">{label}</span></button>)}
            </div>
            <div className="mt-8 rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-3 text-xs text-slate-400"><ShieldCheck className="mb-2 h-4 w-4 text-cyan-200" /><p>{t('guidePrivacyBody')}</p></div>
          </aside>

          <div id="studio-content" className="studio-stage">
            <div className="stage-heading mb-5 flex items-end justify-between">
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{steps[step]}</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{step === 0 ? t('importTitle') : step === 1 ? t('choosePreset') : step === 2 ? t('tuneTitle') : t('exportTitle')}</h1></div>
              <div className="shrink-0 whitespace-nowrap text-right text-xs text-slate-500"><span className="text-slate-300">{step + 1}</span> / {steps.length}</div>
            </div>
            <div className="stage-progress mb-5 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400" animate={{ width: `${((step + 1) / steps.length) * 100}%` }} transition={reduceMotion ? { duration: 0 } : { duration: .18, ease: 'easeOut' }} /></div>
            <nav aria-label={t('workflow')} className="mobile-stepper mb-5 grid grid-cols-4 gap-1 lg:hidden">
              {steps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  disabled={index > step}
                  aria-current={index === step ? 'step' : undefined}
                  onClick={() => index <= step && setStep(index)}
                  className={`min-h-11 rounded-xl px-1.5 py-2 text-[10px] font-semibold ${index === step ? 'bg-cyan-300 text-[#0b1020]' : index < step ? 'bg-cyan-300/10 text-cyan-100' : 'bg-white/5 text-slate-500'}`}
                >
                  <span className="mb-0.5 block text-[9px] opacity-70">{String(index + 1).padStart(2, '0')}</span>
                  {label}
                </button>
              ))}
            </nav>

            <motion.div key={step} {...motionProps}>
                {step === 0 && <section className="space-y-5">
                  {!selectedFile ? (
                    <div
                      onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                      onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragActive(false);
                        addFiles(event.dataTransfer.files);
                      }}
                      className={`dropzone group rounded-3xl border border-dashed p-8 text-center transition sm:p-14 ${dragActive ? 'is-drag-active border-cyan-300/70' : 'border-white/15'}`}
                    >
                      <input
                        id="media-file-input"
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="video/*,audio/*"
                        className="hidden"
                        onChange={(event) => {
                          addFiles(event.target.files || []);
                          event.currentTarget.value = '';
                        }}
                      />
                      <div className="upload-glyph mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200 transition duration-300 group-hover:scale-105">
                        <Upload className="h-7 w-7" />
                      </div>
                      <h2 className="mb-2 text-lg font-semibold text-white">{dragActive ? t('chooseFile') : t('importDescription')}</h2>
                      <p className="mx-auto mb-6 max-w-[52ch] text-sm leading-6 text-slate-400">{t('supported')} · {t('multiFileHint')}</p>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#0b1020]">
                        <FolderOpen className="h-4 w-4" />{t('chooseFile')}
                      </button>
                    </div>
                  ) : <div className="media-preview overflow-hidden rounded-3xl border border-white/10 bg-[#111a30]"><div className="relative aspect-video bg-black"><video ref={videoRef} src={fileUrl} controls className="h-full w-full object-contain" onLoadedMetadata={handleMetadata} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /><canvas ref={canvasRef} className="hidden" /></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4"><div className="flex min-w-0 items-center gap-3"><FileVideo className="h-5 w-5 shrink-0 text-cyan-200" /><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{selectedFile.name}</div><div className="text-xs text-slate-500">{formatBytes(selectedFile.size)} · {duration.toFixed(1)}s</div></div></div><button onClick={() => { setSelectedJobId(null); setSelectedFile(null); setFileUrl(''); setQueue([]); }} className="min-h-11 rounded-lg px-3 py-2 text-xs text-rose-300 hover:bg-rose-300/10"><Trash2 className="mr-1 inline h-3.5 w-3.5" />{t('remove')}</button></div></div>}
                  {recoveredJobs.length > 0 && <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><AlertCircle className="h-4 w-4" />{t('interruptedQueue')}</div><p className="mt-1 text-xs text-slate-400">{t('interruptedQueueBody')} ({recoveredJobs.map((job) => job.fileName).join(', ')})</p></div><div className="flex gap-2"><button onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-amber-200 px-3 py-2 text-xs font-semibold text-[#0b1020]">{t('chooseFilesAgain')}</button><button onClick={() => { setRecoveredJobs([]); localStorage.removeItem(QUEUE_RECOVERY_KEY); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">{t('dismiss')}</button></div></div></div>}
                  {queue.length > 0 && <div className="queue-panel rounded-2xl border border-white/10 bg-[#111a30] p-4">
                    <div className="queue-panel-head mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">{t('queue')} <span className="text-xs font-normal text-slate-500">({queue.length})</span></div>
                      <div className="flex flex-wrap gap-2">
                        {queue.some((job) => job.status === 'completed') && <button onClick={clearCompletedJobs} className="min-h-11 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">{t('clearCompleted')}</button>}
                        {transcoding ? <>
                          <button onClick={toggleQueuePause} className="min-h-11 rounded-lg border border-amber-300/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/10">{queuePaused ? <Play className="mr-1 inline h-3.5 w-3.5" /> : <Pause className="mr-1 inline h-3.5 w-3.5" />}{queuePaused ? t('resumeQueue') : t('pauseQueue')}</button>
                          <button onClick={cancelQueue} className="min-h-11 rounded-lg border border-rose-300/20 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-300/10"><X className="mr-1 inline h-3.5 w-3.5" />{t('cancelQueue')}</button>
                        </> : <button onClick={() => fileInputRef.current?.click()} className="min-h-11 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"><Upload className="mr-1 inline h-3.5 w-3.5" />{t('addMore')}</button>}
                      </div>
                    </div>
                    <div aria-live="polite" aria-busy={transcoding} className="space-y-2">
                      <AnimatePresence initial={false}>
                      {queue.map((job, index) => <motion.div key={job.id} {...(reduceMotion ? { initial: false } : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, height: 0, marginBottom: 0 }, transition: { duration: .14, ease: 'easeOut' } })} className={`queue-item overflow-hidden rounded-xl border p-3 transition ${selectedJobId === job.id ? 'is-selected border-cyan-300/30 bg-cyan-300/5' : 'border-white/5 bg-black/15'}`}>
                        <div className="queue-item-head flex items-start gap-3">
                          <button onClick={() => selectQueueJob(job)} className="queue-file flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                            <span className="queue-file-icon grid shrink-0 place-items-center"><FileVideo className="h-4 w-4" /></span>
                            <span className="min-w-0"><span className="block truncate text-xs font-medium text-white">{job.file.name}</span>
                            <span className="mt-1 block text-[11px] text-slate-500">{job.status === 'failed' ? job.error : t(job.status as TranslationKey)}{job.status === 'processing' && ` · ${progress}%`}</span></span>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <button disabled={transcoding || index === 0} onClick={() => moveJob(job.id, -1)} aria-label={t('moveUp')} className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25"><ArrowUp className="h-3.5 w-3.5" /></button>
                            <button disabled={transcoding || index === queue.length - 1} onClick={() => moveJob(job.id, 1)} aria-label={t('moveDown')} className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-25"><ArrowDown className="h-3.5 w-3.5" /></button>
                            {job.status === 'failed' && <button onClick={() => retryJob(job)} aria-label={t('retry')} className="grid min-h-11 min-w-11 place-items-center rounded-md text-amber-200 hover:bg-amber-300/10"><RotateCcw className="h-3.5 w-3.5" /></button>}
                            {job.status === 'completed' && job.outputUrl && <a href={job.outputUrl} download={job.outputName} aria-label={t('download')} className="grid min-h-11 min-w-11 place-items-center rounded-md text-emerald-200 hover:bg-emerald-300/10"><Download className="h-3.5 w-3.5" /></a>}
                            {job.status !== 'processing' && <button onClick={() => removeJob(job)} aria-label={t('remove')} className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-500 hover:bg-rose-300/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        </div>
                        <div className={`queue-item-settings mt-3 border-t border-white/5 pt-3 ${queue.length > 1 ? 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end' : 'flex justify-end'}`}>
                          {queue.length > 1 && <details className="smooth-details rounded-lg border border-white/10 bg-black/15 px-3 py-2">
                            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-xs text-slate-300">
                              <span>{t('overridePreset')}</span>
                              <span className="flex min-w-0 items-center gap-2 text-slate-500"><span className="max-w-44 truncate">{job.preset.name}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" /></span>
                            </summary>
                            <div className="mt-2 border-t border-white/5 pt-2">
                              <select aria-label={t('overridePreset')} value={job.preset.id} disabled={transcoding || job.status === 'processing'} onChange={(event) => updateJobPreset(job, event.target.value)} className="block w-full rounded-lg border border-white/10 bg-[#0b1020] px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-300/60 disabled:opacity-50">
                                {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                              </select>
                              {job.presetOverridden && <button type="button" onClick={() => clearJobPresetOverride(job)} className="mt-2 text-[11px] text-cyan-200 hover:text-cyan-100">{t('useBatchPreset')}</button>}
                            </div>
                          </details>}
                          <div className="text-[11px] text-slate-500">{t('estimatedOutput')}: <span className="text-slate-300">{getJobEstimate(job)}</span></div>
                        </div>
                      </motion.div>)}
                      </AnimatePresence>
                    </div>
                  </div>}
                  {selectedFile && <div className="trim-panel rounded-2xl border border-white/10 bg-[#111a30] p-5"><div className="trim-panel-head mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4 text-cyan-200" />{t('trim')}</div><span className="trim-readout rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">{trimStart.toFixed(1)}s – {(trimEnd || duration).toFixed(1)}s</span></div><div className="trim-controls grid gap-4 sm:grid-cols-2"><label className="text-xs text-slate-400"><span>{t('start')}</span><strong>{trimStart.toFixed(1)}s</strong><input aria-label={t('start')} type="range" min="0" max={duration || 1} step="0.1" value={trimStart} onChange={(event) => { const value = Math.min(Number(event.target.value), Math.max(0, (trimEnd || duration) - 0.1)); setTrimStart(value); if (selectedJobId) setQueue((current) => current.map((job) => job.id === selectedJobId ? { ...job, trimStart: value } : job)); }} className="mt-3 w-full accent-cyan-300" /></label><label className="text-xs text-slate-400"><span>{t('end')}</span><strong>{(trimEnd || duration).toFixed(1)}s</strong><input aria-label={t('end')} type="range" min="0" max={duration || 1} step="0.1" value={trimEnd || duration} onChange={(event) => { const value = Math.max(Number(event.target.value), trimStart + 0.1); setTrimEnd(value); if (selectedJobId) setQueue((current) => current.map((job) => job.id === selectedJobId ? { ...job, trimEnd: value } : job)); }} className="mt-3 w-full accent-indigo-400" /></label></div></div>}
                  <div className="flex items-center justify-end gap-3">
                    {!selectedFile && <span className="text-xs text-slate-400">{t('chooseFileFirst')}</span>}
                    <button disabled={!selectedFile} onClick={selectAndContinue} className="min-h-11 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0b1020] transition hover:bg-cyan-200 disabled:opacity-40">{t('continue')}<ArrowRight className="ml-2 inline h-4 w-4" /></button>
                  </div>
                </section>}

                {step === 1 && <section className="space-y-5">
                  <div className="preset-toolbar rounded-2xl border border-white/10 bg-[#111a30] p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchPresets')} className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-300/60" /></div><div className="preset-filters flex gap-1 overflow-x-auto">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${category === item ? 'bg-cyan-300 text-[#0b1020]' : 'bg-white/5 text-slate-400 hover:text-white'}`}>{t(categoryKey[item])}</button>)}</div></div><div className="preset-actions mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3"><button onClick={exportPresets} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Download className="mr-1 inline h-3.5 w-3.5" />{t('exportPresets')}</button><button onClick={() => presetImportRef.current?.click()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Upload className="mr-1 inline h-3.5 w-3.5" />{t('importPresets')}</button><input ref={presetImportRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { importPresets(event.target.files?.[0]); event.currentTarget.value = ''; }} /><button onClick={() => setShowHistory((value) => !value)} className={`rounded-lg border px-3 py-2 text-xs ${showHistory ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}><History className="mr-1 inline h-3.5 w-3.5" />{t('aiHistory')} ({aiHistory.length})</button></div></div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-white">{showingRecommended ? t('recommendedPresets') : t('presetLibrary')}</h2>
                    <span className="text-xs text-slate-400">{visiblePresets.length} / {filteredPresets.length}</span>
                  </div>
                  <div role="radiogroup" aria-label={t('presetLibrary')} className="preset-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence initial={false}>
                      {visiblePresets.map((preset) => (
                        <PresetCard
                          key={preset.id}
                          preset={preset}
                          active={activePreset.id === preset.id}
                          builtIn={DEFAULT_PRESETS.some((base) => base.id === preset.id)}
                          reduceMotion={reduceMotion}
                          t={t}
                          onSelect={() => selectBatchPreset(preset)}
                          onFavorite={() => toggleFavorite(preset)}
                          onRename={() => renamePreset(preset)}
                          onEditTags={() => editPresetTags(preset)}
                          onDuplicate={() => duplicatePreset(preset)}
                          onDelete={() => deletePreset(preset)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                  {category === 'all' && !query.trim() && filteredPresets.length > 3 && (
                    <button type="button" onClick={() => setShowAllPresets((value) => !value)} className="min-h-11 w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">
                      {showAllPresets ? t('showFewerPresets') : `${t('browseAllPresets')} (${filteredPresets.length})`}
                    </button>
                  )}
                  {!filteredPresets.length && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">{t('noResults')}<br />{t('tryAnother')}</div>}
                  <AnimatePresence initial={false}>{showHistory && <motion.div {...collapseProps} className="overflow-hidden rounded-2xl border border-indigo-300/20 bg-indigo-300/5"><div className="p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{t('aiHistory')}</h3><button onClick={() => { setAiHistory([]); writeAIHistory([]); localStorage.removeItem(AI_HISTORY_STORAGE_KEY); }} className="text-xs text-slate-400 hover:text-rose-200">{t('clearHistory')}</button></div>{aiHistory.length ? <div className="space-y-2">{aiHistory.slice(0, 6).map((item, index) => <motion.button {...(reduceMotion ? { initial: false } : { initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0 }, transition: { delay: index * .035 } })} key={item.id} onClick={() => { const restored: Preset = { ...item.preset, id: `history-${item.id}`, source: 'ai', tags: ['ai', 'history'] }; persistPresets([...presets, restored]); selectBatchPreset(restored); setToast(t('historyRestored')); }} className="w-full rounded-xl border border-white/10 bg-black/15 p-3 text-left hover:border-indigo-300/40"><div className="flex items-center justify-between gap-2 text-xs text-white"><span className="truncate">{item.prompt}</span><span className="shrink-0 text-slate-500">{new Date(item.createdAt).toLocaleDateString(locale)}</span></div><div className="mt-1 text-[11px] text-slate-500">{item.provider} · {item.model}</div></motion.button>)}</div> : <p className="text-xs text-slate-500">{t('historyEmpty')}</p>}</div></motion.div>}</AnimatePresence>
                  <details className="ai-disclosure smooth-details rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-indigo-400/10 to-cyan-300/5">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-5 text-sm font-semibold text-white">
                      <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-200" />{t('createWithAI')}</span>
                      <ChevronDown className="h-4 w-4 text-indigo-200" />
                    </summary>
                    <div className="border-t border-indigo-300/15 p-5 pt-4">
                      <p className="mb-4 text-xs leading-5 text-slate-400">{t('aiPrivacy')}</p>
                      <div className="mb-3 flex justify-end">
                        <button onClick={() => setPanel('settings')} className="min-h-11 rounded-lg border border-indigo-300/20 px-3 py-2 text-[11px] text-indigo-100 hover:bg-indigo-300/10">{t('aiPoweredBy')} {getAIProvider(settings.aiProvider).name} · {settings.aiModel}</button>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && generatePreset()} placeholder={t('aiHint')} className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-indigo-300/70" />
                        <button disabled={aiGenerating || !aiPrompt.trim()} onClick={generatePreset} className="min-h-11 rounded-xl bg-indigo-300 px-4 py-3 text-sm font-semibold text-[#0b1020] disabled:opacity-40">{aiGenerating ? t('generating') : t('generate')}<Wand2 className="ml-2 inline h-4 w-4" /></button>
                      </div>
                      {aiError && <p className="mt-3 text-xs text-rose-300"><AlertCircle className="mr-1 inline h-4 w-4" />{aiError}</p>}
                    </div>
                  </details>
                  <div className="hidden justify-between sm:flex"><button onClick={() => setStep(0)} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><ArrowLeft className="mr-2 inline h-4 w-4" />{t('back')}</button><button onClick={continueToAdjust} className="min-h-11 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0b1020]">{t('continue')}<ArrowRight className="ml-2 inline h-4 w-4" /></button></div>
                  <div className="mobile-action-dock sticky bottom-3 z-10 rounded-2xl border border-cyan-300/20 bg-[#101827]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:hidden">
                    <div className="mb-2 min-w-0">
                      <div className="truncate text-xs font-semibold text-white">{activePreset.name}</div>
                      <div className="truncate text-[11px] text-slate-400">{configuredPreset.settings.format.toUpperCase()} · {configuredPreset.settings.resolution} · {configuredPreset.settings.fps} FPS</div>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <button onClick={() => setStep(0)} aria-label={t('back')} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 text-slate-300"><ArrowLeft className="h-4 w-4" /></button>
                      <button onClick={continueToAdjust} className="min-h-11 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0b1020]">{t('continue')}<ArrowRight className="ml-2 inline h-4 w-4" /></button>
                    </div>
                  </div>
                </section>}

                {step === 2 && <section className="space-y-5">
                  <section aria-label={t('effectiveOutput')} className={`output-summary rounded-2xl border p-5 ${exactEngineRecommended ? 'border-amber-300/25 bg-amber-300/5' : 'border-cyan-300/20 bg-cyan-300/5'}`}>
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('effectiveOutput')}</div>
                        <div className="break-words text-base font-semibold text-white">{outputSummary}</div>
                        {nativeMode && <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">{t(nativeSourceUnsupported ? 'audioNeedsFfmpeg' : 'nativeOutputNote')}</p>}
                      </div>
                      <div role="group" aria-label={t('engine')} className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/15 p-1">
                        <button type="button" disabled={queue.length > 1 || nativeSourceUnsupported} aria-pressed={nativeMode && !nativeSourceUnsupported} onClick={() => setEngine('native')} className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold ${nativeMode && !nativeSourceUnsupported ? 'bg-cyan-300 text-[#0b1020]' : 'text-slate-400 hover:text-white'} disabled:opacity-35`}>{t('quickOutput')}</button>
                        <button type="button" disabled={ffmpegLoading} aria-pressed={!nativeMode} onClick={() => ffmpeg ? setEngine('ffmpeg') : void loadFFmpeg()} className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold ${!nativeMode ? 'bg-indigo-300 text-[#0b1020]' : 'text-slate-400 hover:text-white'} disabled:opacity-50`}>{ffmpegLoading ? t('loadingEngine') : t('exactOutput')}</button>
                      </div>
                    </div>
                  </section>
                  <div className="settings-grid grid gap-4 rounded-2xl border border-white/10 bg-[#111a30] p-5 sm:grid-cols-2">
                    <Field label={t('format')}><select disabled={nativeMode} value={nativeMode && !nativeSourceUnsupported ? 'webm' : customFormat} onChange={(event) => setCustomFormat(event.target.value as PresetSettings['format'])}>{OUTPUT_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                    <Field label={t('videoCodec')}><select disabled={nativeMode} value={nativeMode && !nativeSourceUnsupported ? 'vp9' : customVcodec} onChange={(event) => updateVideoCodec(event.target.value as PresetSettings['vcodec'])}>{VIDEO_CODEC_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                    <Field label={t('resolution')}><select value={customResolution} onChange={(event) => setCustomResolution(event.target.value as PresetSettings['resolution'])}>{RESOLUTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                    <Field label={t('frameRate')}><select value={customFps} onChange={(event) => setCustomFps(Number(event.target.value))}>{FRAME_RATE_OPTIONS.map((fps) => <option key={fps} value={fps}>{fps} FPS</option>)}</select></Field>
                    <Field label={t('bitrate')}><select value={customVbitrate} onChange={(event) => setCustomVbitrate(event.target.value)}>{VIDEO_BITRATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                    <Field label={t('audioCodec')}><select disabled={nativeMode || !customAudioEnabled} value={customAudioEnabled ? customAcodec : 'none'} onChange={(event) => updateAudioCodec(event.target.value as PresetSettings['acodec'])}>{AUDIO_CODEC_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                    <div className="sm:col-span-2"><span className="mb-2 block text-xs text-slate-400">{t('audioTrack')}</span><button disabled={nativeMode} onClick={updateAudioEnabled} className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-55 ${effectiveAudio ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-black/20 text-slate-500'}`}>{effectiveAudio ? t('enabled') : t('videoOnly')}{effectiveAudio ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div>
                  </div>
                  {!nativeMode ? <details className="smooth-details rounded-2xl border border-white/10 bg-[#111a30] p-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-white">{t('advanced')}<ChevronDown className="h-4 w-4 text-slate-500" /></summary><textarea value={customArgs} onChange={(event) => setCustomArgs(event.target.value)} rows={3} className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-300/60" /></details> : null}
                  <div className="flex flex-col justify-between gap-3 sm:flex-row"><button onClick={saveCustomPreset} className="min-h-11 rounded-xl border border-cyan-300/20 px-4 py-3 text-sm text-cyan-100 hover:bg-cyan-300/10">{t('savePreset')}</button><div className="flex gap-2"><button onClick={() => setStep(1)} className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><ArrowLeft className="mr-2 inline h-4 w-4" />{t('back')}</button><button disabled={transcoding || ffmpegLoading || !selectedFile || (nativeMode && queue.length > 1)} onClick={nativeMode && nativeSourceUnsupported ? () => void loadFFmpeg() : handleTranscode} className="min-h-11 flex-1 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0b1020] disabled:opacity-40">{ffmpegLoading ? t('loadingEngine') : transcoding ? t(conversionStage) : nativeMode && nativeSourceUnsupported ? t('loadExactEngine') : nativeMode ? t('convertToWebm') : queue.length > 1 ? `${t('startQueue')} (${queue.length})` : t('startTranscode')}<ArrowRight className="ml-2 inline h-4 w-4" /></button></div></div>
                  <AnimatePresence>{transcoding && <motion.div {...collapseProps} role="status" aria-live="polite" className="overflow-hidden rounded-xl border border-white/10 bg-[#111a30]"><div className="p-4"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>{t(conversionStage)}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-cyan-300 to-indigo-400" animate={{ width: `${progress}%` }} transition={reduceMotion ? { duration: 0 } : { duration: .16, ease: 'linear' }} /></div></div></motion.div>}</AnimatePresence>
                </section>}

                {step === 3 && <section className="space-y-5">
                  {outputUrl ? <div className="overflow-hidden rounded-3xl border border-emerald-300/30 bg-emerald-300/5"><div className="flex items-center gap-3 border-b border-emerald-300/20 p-5"><CheckCircle2 className="h-6 w-6 text-emerald-200" /><div><h2 className="font-semibold text-white">{t('complete')}</h2><p className="text-xs text-slate-400">{outputName} · {outputSize} {elapsed ? `· ${elapsed}s ${t('elapsed')}` : ''}</p></div></div><div className="aspect-video bg-black"><video src={outputUrl} controls autoPlay className="h-full w-full object-contain" /></div><a href={outputUrl} download={outputName} className="m-5 block rounded-xl bg-emerald-300 px-4 py-3 text-center text-sm font-semibold text-[#0b1020]"><Download className="mr-2 inline h-4 w-4" />{t('download')}</a></div> : <div className="rounded-3xl border border-dashed border-white/10 bg-[#111a30] p-12 text-center text-sm text-slate-500">{t('emptyOutput')}</div>}
                  {conversionHistory.length > 0 && <div className="rounded-2xl border border-white/10 bg-[#111a30] p-4"><div className="flex items-center justify-between gap-3"><button onClick={() => setShowConversionHistory((value) => !value)} aria-expanded={showConversionHistory} className="flex items-center gap-2 text-sm font-semibold text-white"><History className="h-4 w-4 text-cyan-200" />{t('conversionHistory')} ({conversionHistory.length})<ChevronDown className={`h-4 w-4 text-slate-500 transition ${showConversionHistory ? 'rotate-180' : ''}`} /></button>{showConversionHistory && <button onClick={() => { conversionHistoryRef.current = []; setConversionHistory([]); writeConversionHistory([]); localStorage.removeItem(CONVERSION_HISTORY_STORAGE_KEY); }} className="text-xs text-slate-400 hover:text-rose-200">{t('clearHistory')}</button>}</div>{showConversionHistory && <div className="mt-3 space-y-2">{conversionHistory.slice(0, 12).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/15 p-3"><div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${item.status === 'completed' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-rose-300/10 text-rose-200'}`}>{item.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-white">{item.fileName}</div><div className="truncate text-[11px] text-slate-500">{item.status === 'failed' ? item.error : `${item.outputName} · ${item.outputSize}`} · {item.engine === 'ffmpeg' ? t('ffmpegEngine') : t('nativeEngine')}</div></div><button onClick={() => { selectPreset(item.preset); setStep(2); setToast(t('historyPresetLoaded')); }} className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-cyan-100 hover:bg-cyan-300/10">{t('reusePreset')}</button></div>)}</div>}</div>}
                  <button onClick={() => setStep(0)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><ArrowLeft className="mr-2 inline h-4 w-4" />{t('importStep')}</button></section>}
            </motion.div>
          </div>
        </section>

        <footer className="status-bar flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#111a30] p-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`status-dot h-2 w-2 rounded-full ${isOnline ? 'bg-cyan-300' : 'bg-amber-300'}`} />
            <span>{isOnline ? t('online') : t('offline')}</span>
            <span aria-hidden="true">·</span>
            <span className="rounded-full bg-white/5 px-2 py-1">{t('engine')}: {engine === 'ffmpeg' ? t('ffmpegEngine') : nativeSourceUnsupported ? t('ffmpegRequired') : t('quickOutput')}</span>
            <span className="rounded-full bg-white/5 px-2 py-1">AI: {getAIProvider(settings.aiProvider).name}</span>
          </div>
          <button aria-expanded={showDiagnostics} onClick={() => setShowDiagnostics((value) => !value)} className="min-h-11 rounded-lg px-2 text-left hover:bg-white/5 hover:text-slate-200">{t('diagnostics')} <ChevronDown className={`ml-1 inline h-3.5 w-3.5 transition ${showDiagnostics ? 'rotate-180' : ''}`} /></button>
        </footer>
        <AnimatePresence initial={false}>{showDiagnostics && <motion.div {...collapseProps} className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 font-mono text-[11px] text-slate-500"><div className="p-4"><div className="mb-2 flex justify-between"><span>{logs.length} events</span><button onClick={() => setLogs([])}>{t('clear')}</button></div>{logs.map((item, index) => <div key={`${item}-${index}`} className="border-l border-cyan-300/20 py-0.5 pl-2">{item}</div>)}</div></motion.div>}</AnimatePresence>
      </div>

      <AnimatePresence>
        {panel && <><motion.button aria-label={t('close')} className="fixed inset-0 z-30 bg-black/65 backdrop-blur-md" onClick={() => setPanel(null)} {...(reduceMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.16, ease: 'easeOut' } })} /><motion.aside ref={dialogRef} role="dialog" aria-modal="true" aria-label={panel === 'guide' ? t('guide') : t('settingsTitle')} className="dialog-panel fixed right-0 top-0 z-40 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#111a30] p-5 shadow-2xl shadow-black/40 sm:p-7" {...(reduceMotion ? {} : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: { duration: .22, ease: [0.22, 1, 0.36, 1] } })}><div className="mb-8 flex items-center justify-between"><h2 className="text-xl font-semibold tracking-tight text-white">{panel === 'guide' ? t('guide') : t('settingsTitle')}</h2><button aria-label={`${t('close')} ${panel === 'guide' ? t('guide') : t('settingsTitle')}`} onClick={() => setPanel(null)} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div>{panel === 'guide' ? <Guide t={t} /> : <SettingsPanel t={t} settings={settings} ffmpeg={ffmpeg} ffmpegLoading={ffmpegLoading} ffmpegError={ffmpegError} onUpdate={updateSettings} onLoad={loadFFmpeg} onToast={setToast} onClearPresets={() => { localStorage.removeItem(PRESETS_STORAGE_KEY); localStorage.removeItem('ocularmp4.presets.v1'); setPresets(DEFAULT_PRESETS); setToast(t('clearPresets')); }} />}</motion.aside></>}
      </AnimatePresence>
      <AnimatePresence>{updateWorker && <motion.div role="status" {...(reduceMotion ? { initial: false } : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 }, transition: { duration: .18, ease: 'easeOut' } })} className="fixed bottom-5 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-indigo-300/30 bg-[#151b32]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:right-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-300/15 text-indigo-200"><Sparkles className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{t('updateAvailable')}</div><p className="mt-1 text-xs leading-5 text-slate-400">{t('updateAvailableBody')}</p><button onClick={applyAppUpdate} disabled={transcoding} className="mt-3 inline-flex items-center rounded-lg bg-indigo-300 px-3 py-2 text-xs font-semibold text-[#0b1020] disabled:opacity-40">{t('updateNow')}</button></div></div></motion.div>}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-300/30 bg-[#14213d] px-4 py-3 text-sm text-cyan-100 shadow-xl" {...(reduceMotion ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: .14, ease: 'easeOut' } })}>{toast}</motion.div>}</AnimatePresence>
    </main>
  );
}

function PresetCard({
  preset,
  active,
  builtIn,
  reduceMotion,
  t,
  onSelect,
  onFavorite,
  onRename,
  onEditTags,
  onDuplicate,
  onDelete,
}: {
  preset: Preset;
  active: boolean;
  builtIn: boolean;
  reduceMotion: boolean;
  t: (key: TranslationKey) => string;
  onSelect: () => void;
  onFavorite: () => void;
  onRename: () => void;
  onEditTags: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      {...(reduceMotion ? { initial: false } : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: .12, ease: 'easeOut' as const } })}
      className={`preset-card relative overflow-hidden rounded-2xl border transition ${active ? 'is-active border-cyan-300/70 bg-cyan-300/10' : 'border-white/10 bg-[#111a30] hover:border-white/25'}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onSelect}
        className="block min-h-11 w-full p-4 pr-14 text-left"
      >
        <span className="mb-2 flex items-start gap-2">
          <span className="min-w-0 flex-1 font-medium text-white">{preset.name}</span>
          {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />}
        </span>
        <span className="mb-3 block text-xs leading-relaxed text-slate-400">{preset.description}</span>
        {Boolean(preset.tags?.length) && <span className="mb-3 flex flex-wrap gap-1">{preset.tags?.map((tag) => <span key={tag} className="rounded-full bg-indigo-300/10 px-2 py-0.5 text-[10px] text-indigo-100">#{tag}</span>)}</span>}
        <span className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="rounded-md bg-black/20 px-2 py-1 uppercase text-cyan-100">{preset.settings.format}</span>
          <span className="rounded-md bg-black/20 px-2 py-1 uppercase text-slate-200">{preset.settings.vcodec}</span>
          <span>{preset.settings.resolution} · {preset.settings.fps} FPS</span>
          <span>{preset.settings.audioEnabled ? preset.settings.acodec.toUpperCase() : t('videoOnly')}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`${t('favorite')}: ${preset.name}`}
        aria-pressed={Boolean(preset.favorite)}
        onClick={onFavorite}
        className={`absolute right-2 top-2 grid min-h-11 min-w-11 place-items-center rounded-xl ${preset.favorite ? 'text-rose-300' : 'text-slate-500 hover:bg-white/5 hover:text-rose-300'}`}
      >
        <motion.span animate={reduceMotion ? undefined : { scale: preset.favorite ? [1, 1.14, 1] : 1 }} transition={{ duration: .18 }} className="block">
          <Heart className="h-4 w-4" fill={preset.favorite ? 'currentColor' : 'none'} />
        </motion.span>
      </button>
      {!builtIn && (
        <div className="flex items-center justify-end gap-1 border-t border-white/10 px-2 py-1.5">
          <button type="button" aria-label={t('renamePreset')} onClick={onRename} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label={t('editTags')} onClick={onEditTags} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><Tag className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label={t('duplicatePreset')} onClick={onDuplicate} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">⧉</button>
          <button type="button" aria-label={t('deletePreset')} onClick={onDelete} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-400 hover:bg-rose-300/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-slate-400"><span className="mb-2 block">{label}</span><span className="block [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-white/10 [&>select]:bg-black/20 [&>select]:px-3 [&>select]:py-2.5 [&>select]:text-sm [&>select]:text-white [&>select]:outline-none">{children}</span></label>;
}

function Guide({ t }: { t: (key: TranslationKey) => string }) {
  const cards = [['guideImport', 'guideImportBody', FileVideo], ['guidePreset', 'guidePresetBody', Layers3], ['guideEngine', 'guideEngineBody', Cpu], ['guideExport', 'guideExportBody', Download]] as const;
  return <div className="space-y-4"><p className="text-sm leading-relaxed text-slate-400">{t('guideIntro')}</p>{cards.map(([title, body, Icon]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="mb-3 h-5 w-5 text-cyan-200" /><h3 className="mb-1 text-sm font-semibold text-white">{t(title as TranslationKey)}</h3><p className="text-xs leading-relaxed text-slate-400">{t(body as TranslationKey)}</p></div>)}<div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4"><ShieldCheck className="mb-3 h-5 w-5 text-cyan-200" /><h3 className="mb-1 text-sm font-semibold text-white">{t('guidePrivacy')}</h3><p className="text-xs leading-relaxed text-slate-400">{t('guidePrivacyBody')}</p></div></div>;
}
