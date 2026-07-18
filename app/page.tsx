'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Cpu, Download, FileVideo, FolderOpen, Layers3, Menu,
  Heart, History, Pencil, Search, Settings2, ShieldCheck, Sparkles, Tag, Trash2, Upload, Volume2, VolumeX,
  Wand2, X
} from 'lucide-react';
import { translations, type Locale, type TranslationKey } from '../lib/i18n';
import { generateDirectPreset, getAIProvider } from '../lib/ai-providers';
import { DEFAULT_SETTINGS, readAICredential, readSettings, writeSettings, type AppSettings } from '../lib/settings';
import {
  AI_HISTORY_STORAGE_KEY, PRESETS_STORAGE_KEY, parseImportedPresets, readAIHistory, readStoredPresets,
  writeAIHistory, writeStoredPresets, type AIHistoryItem, type Preset, type PresetSettings,
} from '../lib/preset-workspace';
import { SettingsPanel } from '../components/settings-panel';

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
    name: 'Small file for chat',
    description: 'Compact WebM output for strict upload limits.',
    category: 'size',
    ffmpegArgs: ['-c:v', 'libvpx-vp9', '-b:v', '350k', '-crf', '35', '-vf', 'scale=-2:480', '-c:a', 'libopus', '-b:a', '64k'],
    settings: { format: 'webm', vcodec: 'vp9', acodec: 'opus', resolution: '480p', fps: 24, vbitrate: '350k', abitrate: '64k', audioEnabled: true, volume: 1 },
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
];

const categories: Array<'all' | Preset['category']> = ['all', 'compatible', 'size', 'hq', 'audio', 'gif', 'custom'];
const categoryKey: Record<string, TranslationKey> = { all: 'all', compatible: 'compatible', size: 'small', hq: 'quality', audio: 'audio', gif: 'gif', custom: 'custom' };
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
  const [fileUrl, setFileUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [aiHistory, setAiHistory] = useState<AIHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset>(DEFAULT_PRESETS[0]);
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [query, setQuery] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [ffmpeg, setFfmpeg] = useState<any>(null);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegError, setFfmpegError] = useState('');
  const [engine, setEngine] = useState<'native' | 'ffmpeg'>('native');
  const [transcoding, setTranscoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState('');
  const [outputName, setOutputName] = useState('');
  const [outputSize, setOutputSize] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>(['Native browser engine ready.']);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetImportRef = useRef<HTMLInputElement>(null);

  const t = (key: TranslationKey) => translations[locale][key];
  const reduceMotion = settings.motion === 'reduced' || (settings.motion === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionProps = reduceMotion ? { initial: false, animate: undefined, exit: undefined, transition: { duration: 0 } } : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.22 } };

  const [customFormat, setCustomFormat] = useState<PresetSettings['format']>(activePreset.settings.format);
  const [customVcodec, setCustomVcodec] = useState<PresetSettings['vcodec']>(activePreset.settings.vcodec);
  const [customAcodec, setCustomAcodec] = useState<PresetSettings['acodec']>(activePreset.settings.acodec);
  const [customResolution, setCustomResolution] = useState<PresetSettings['resolution']>(activePreset.settings.resolution);
  const [customFps, setCustomFps] = useState(activePreset.settings.fps);
  const [customVbitrate, setCustomVbitrate] = useState(activePreset.settings.vbitrate);
  const [customAudioEnabled, setCustomAudioEnabled] = useState(activePreset.settings.audioEnabled);
  const [customArgs, setCustomArgs] = useState(activePreset.ffmpegArgs.join(' '));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readSettings();
      setSettings(stored);
      setLocale(stored.locale);
      setEngine(stored.defaultEngine);
      try {
        setPresets(readStoredPresets(DEFAULT_PRESETS));
        setAiHistory(readAIHistory());
      } catch { /* preserve defaults when storage is invalid */ }
      setSettingsReady(true);
    }, 0);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.motion = settings.motion;
    writeSettings({ ...settings, locale });
  }, [locale, settings, settingsReady]);

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

  const log = (message: string) => setLogs((items) => [...items.slice(-80), `[${new Date().toLocaleTimeString()}] ${message}`]);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    if (patch.locale) setLocale(patch.locale);
    if (patch.defaultEngine) setEngine(patch.defaultEngine);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setFileUrl(url);
    setOutputUrl('');
    setOutputName('');
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setStep(0);
    log(`Selected ${file.name}`);
  };

  const handleMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const length = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
    setDuration(length);
    setTrimEnd(length);
  };

  const selectAndContinue = () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const loadFFmpeg = async () => {
    if (ffmpeg) return;
    setFfmpegLoading(true);
    setFfmpegError('');
    try {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
      const instance = new FFmpeg();
      instance.on('progress', ({ progress: value }: { progress: number }) => setProgress(Math.min(99, Math.round(value * 100))));
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await instance.load({ coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm') });
      setFfmpeg(instance);
      setEngine('ffmpeg');
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
      selectPreset(generated);
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

  const handleTranscode = async () => {
    if (!selectedFile || !videoRef.current) return;
    setTranscoding(true);
    setProgress(0);
    setOutputUrl('');
    const started = Date.now();
    try {
      if (engine === 'ffmpeg') {
        if (!ffmpeg) throw new Error('Load FFmpeg.wasm first.');
        const { fetchFile } = await import('@ffmpeg/util');
        const inputExt = selectedFile.name.split('.').pop() || 'mp4';
        const inputName = `input.${inputExt}`;
        const output = `output.${customFormat}`;
        await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));
        const args = ['-ss', trimStart.toFixed(3), '-to', (trimEnd || duration).toFixed(3), '-i', inputName, ...customArgs.split(/\s+/).filter(Boolean), output];
        await ffmpeg.exec(args);
        const data = await ffmpeg.readFile(output);
        const blob = new Blob([data], { type: getMimeType(customFormat) });
        setOutputUrl(URL.createObjectURL(blob));
        setOutputName(`converted_${selectedFile.name.replace(/\.[^/.]+$/, '')}.${customFormat}`);
        setOutputSize(formatBytes(blob.size));
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(output);
      } else {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Preview canvas unavailable.');
        const width = customResolution === '1080p' ? 1920 : customResolution === '720p' ? 1280 : customResolution === '480p' ? 854 : customResolution === '360p' ? 640 : video.videoWidth;
        const height = customResolution === '1080p' ? 1080 : customResolution === '720p' ? 720 : customResolution === '480p' ? 480 : customResolution === '360p' ? 360 : video.videoHeight;
        canvas.width = width || 1280;
        canvas.height = height || 720;
        const stream = canvas.captureStream(customFps);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: getBitrateValue(customVbitrate) });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
        const finished = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            setOutputUrl(URL.createObjectURL(blob));
            setOutputName(`converted_${selectedFile.name.replace(/\.[^/.]+$/, '')}.webm`);
            setOutputSize(formatBytes(blob.size));
            resolve();
          };
        });
        video.currentTime = trimStart;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        recorder.start();
        await video.play();
        const draw = () => {
          if (video.currentTime < (trimEnd || duration)) {
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            setProgress(Math.min(99, Math.round(((video.currentTime - trimStart) / Math.max(0.1, (trimEnd || duration) - trimStart)) * 100)));
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
      setStep(3);
      setToast(t('complete'));
    } catch (error: any) {
      setToast(error?.message || t('error'));
    } finally {
      setTranscoding(false);
    }
  };

  const steps = [t('importStep'), t('presetStep'), t('adjustStep'), t('exportStep')];

  return (
    <main className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-20 mb-7 flex items-center justify-between rounded-2xl border border-white/10 bg-[#111a30]/90 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-lg font-black text-[#0b1020]">E</div>
            <div>
              <div className="font-semibold tracking-tight text-white">{t('appName')}</div>
              <div className="hidden text-xs text-slate-400 sm:block">{t('appTagline')}</div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <button className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white">{t('studio')}</button>
            <button onClick={() => setPanel('guide')} className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"><CircleHelp className="mr-1.5 inline h-4 w-4" />{t('guide')}</button>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-lg border border-white/10 bg-black/20 p-0.5 sm:flex" aria-label={t('language')}>
              {(['en', 'id'] as Locale[]).map((item) => <button key={item} onClick={() => updateSettings({ locale: item })} className={`rounded-md px-2 py-1 text-xs font-semibold ${locale === item ? 'bg-cyan-300 text-[#0b1020]' : 'text-slate-400'}`}>{item.toUpperCase()}</button>)}
            </div>
            <button onClick={() => setPanel('settings')} aria-label={t('settings')} className="rounded-xl border border-white/10 p-2.5 text-slate-300 transition hover:border-cyan-300/50 hover:text-white"><Settings2 className="h-5 w-5" /></button>
            <button className="rounded-xl border border-white/10 p-2.5 text-slate-300 md:hidden" aria-label={t('guide')} onClick={() => setPanel('guide')}><Menu className="h-5 w-5" /></button>
          </div>
        </header>

        <section className="mb-7 grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="hidden rounded-2xl border border-white/10 bg-[#111a30] p-3 lg:block">
            <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('workflow')}</div>
            <div className="space-y-1">
              {steps.map((label, index) => <button key={label} onClick={() => index <= step && setStep(index)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${step === index ? 'bg-cyan-300 text-[#0b1020]' : index < step ? 'text-cyan-200 hover:bg-white/5' : 'text-slate-500'}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step === index ? 'bg-[#0b1020] text-cyan-200' : index < step ? 'bg-cyan-300/15 text-cyan-200' : 'bg-white/5'}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span>{label}</button>)}
            </div>
            <div className="mt-8 rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-3 text-xs text-slate-400"><ShieldCheck className="mb-2 h-4 w-4 text-cyan-200" /><p>{t('guidePrivacyBody')}</p></div>
          </aside>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{steps[step]}</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{step === 0 ? t('importTitle') : step === 1 ? t('choosePreset') : step === 2 ? t('tuneTitle') : t('exportTitle')}</h1></div>
              <div className="text-right text-xs text-slate-500"><span className="text-slate-300">{step + 1}</span> / {steps.length}</div>
            </div>
            <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400" animate={{ width: `${((step + 1) / steps.length) * 100}%` }} transition={{ duration: reduceMotion ? 0 : 0.3 }} /></div>

            <AnimatePresence mode="wait">
              <motion.div key={step} {...motionProps}>
                {step === 0 && <section className="space-y-5">
                  {!selectedFile ? <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]); }} onClick={() => fileInputRef.current?.click()} className="group cursor-pointer rounded-3xl border border-dashed border-white/15 bg-[#111a30] p-8 text-center transition hover:border-cyan-300/60 hover:bg-[#14213d] sm:p-14"><input ref={fileInputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} /><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200 transition group-hover:scale-105"><Upload className="h-7 w-7" /></div><h2 className="mb-2 text-lg font-semibold text-white">{t('importDescription')}</h2><p className="mb-6 text-sm text-slate-400">{t('supported')}</p><span className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#0b1020]"><FolderOpen className="h-4 w-4" />{t('chooseFile')}</span></div> : <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#111a30]"><div className="relative aspect-video bg-black"><video ref={videoRef} src={fileUrl} controls className="h-full w-full object-contain" onLoadedMetadata={handleMetadata} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /><canvas ref={canvasRef} className="hidden" /></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4"><div className="flex min-w-0 items-center gap-3"><FileVideo className="h-5 w-5 shrink-0 text-cyan-200" /><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{selectedFile.name}</div><div className="text-xs text-slate-500">{formatBytes(selectedFile.size)} · {duration.toFixed(1)}s</div></div></div><button onClick={() => { setSelectedFile(null); setFileUrl(''); }} className="rounded-lg px-3 py-2 text-xs text-rose-300 hover:bg-rose-300/10"><Trash2 className="mr-1 inline h-3.5 w-3.5" />{t('remove')}</button></div></div>}
                  {selectedFile && <div className="rounded-2xl border border-white/10 bg-[#111a30] p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 className="h-4 w-4 text-cyan-200" />{t('trim')}</div><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">{trimStart.toFixed(1)}s – {(trimEnd || duration).toFixed(1)}s</span></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-slate-400">{t('start')}<input aria-label={t('start')} type="range" min="0" max={duration || 1} step="0.1" value={trimStart} onChange={(event) => setTrimStart(Math.min(Number(event.target.value), Math.max(0, (trimEnd || duration) - 0.1)))} className="mt-3 w-full accent-cyan-300" /></label><label className="text-xs text-slate-400">{t('end')}<input aria-label={t('end')} type="range" min="0" max={duration || 1} step="0.1" value={trimEnd || duration} onChange={(event) => setTrimEnd(Math.max(Number(event.target.value), trimStart + 0.1))} className="mt-3 w-full accent-indigo-400" /></label></div></div>}
                  <div className="flex justify-end"><button onClick={selectAndContinue} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0b1020] transition hover:bg-cyan-200">{t('continue')}<ArrowRight className="ml-2 inline h-4 w-4" /></button></div>
                </section>}

                {step === 1 && <section className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-[#111a30] p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchPresets')} className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-300/60" /></div><div className="flex gap-1 overflow-x-auto">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${category === item ? 'bg-cyan-300 text-[#0b1020]' : 'bg-white/5 text-slate-400 hover:text-white'}`}>{t(categoryKey[item])}</button>)}</div></div><div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3"><button onClick={exportPresets} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Download className="mr-1 inline h-3.5 w-3.5" />{t('exportPresets')}</button><button onClick={() => presetImportRef.current?.click()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Upload className="mr-1 inline h-3.5 w-3.5" />{t('importPresets')}</button><input ref={presetImportRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { importPresets(event.target.files?.[0]); event.currentTarget.value = ''; }} /><button onClick={() => setShowHistory((value) => !value)} className={`rounded-lg border px-3 py-2 text-xs ${showHistory ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}><History className="mr-1 inline h-3.5 w-3.5" />{t('aiHistory')} ({aiHistory.length})</button></div></div>
                  <div className="grid gap-3 md:grid-cols-2">{filteredPresets.map((preset) => <div key={preset.id} onClick={() => selectPreset(preset)} onKeyDown={(event) => event.key === 'Enter' && selectPreset(preset)} role="button" tabIndex={0} className={`cursor-pointer rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${activePreset.id === preset.id ? 'border-cyan-300/70 bg-cyan-300/10' : 'border-white/10 bg-[#111a30] hover:border-white/25'}`}><div className="mb-2 flex items-start justify-between gap-3"><span className="font-medium text-white">{preset.name}</span><div className="flex items-center gap-1"><button aria-label={t('favorite')} onClick={(event) => { event.stopPropagation(); toggleFavorite(preset); }} className={`rounded-md p-1 ${preset.favorite ? 'text-rose-300' : 'text-slate-600 hover:text-rose-300'}`}><Heart className="h-4 w-4" fill={preset.favorite ? 'currentColor' : 'none'} /></button>{activePreset.id === preset.id && <Check className="h-4 w-4 shrink-0 text-cyan-200" />}</div></div><p className="mb-3 text-xs leading-relaxed text-slate-400">{preset.description}</p>{Boolean(preset.tags?.length) && <div className="mb-3 flex flex-wrap gap-1">{preset.tags?.map((tag) => <span key={tag} className="rounded-full bg-indigo-300/10 px-2 py-0.5 text-[10px] text-indigo-100">#{tag}</span>)}</div>}<div className="flex items-center justify-between gap-2 text-[11px] text-slate-500"><div className="flex items-center gap-2"><span className="rounded-md bg-black/20 px-2 py-1 uppercase text-cyan-100">{preset.settings.format}</span><span>{preset.settings.resolution} · {preset.settings.fps} FPS</span></div>{!DEFAULT_PRESETS.some((base) => base.id === preset.id) && <div className="flex gap-1"><button aria-label={t('renamePreset')} onClick={(event) => { event.stopPropagation(); renamePreset(preset); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button><button aria-label={t('editTags')} onClick={(event) => { event.stopPropagation(); editPresetTags(preset); }} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Tag className="h-3.5 w-3.5" /></button><button aria-label={t('duplicatePreset')} onClick={(event) => { event.stopPropagation(); duplicatePreset(preset); }} className="rounded-md px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white">⧉</button><button aria-label={t('deletePreset')} onClick={(event) => { event.stopPropagation(); deletePreset(preset); }} className="rounded-md px-2 py-1 text-slate-400 hover:bg-rose-300/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button></div>}</div></div>)}</div>
                  {!filteredPresets.length && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">{t('noResults')}<br />{t('tryAnother')}</div>}
                  {showHistory && <div className="rounded-2xl border border-indigo-300/20 bg-indigo-300/5 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{t('aiHistory')}</h3><button onClick={() => { setAiHistory([]); writeAIHistory([]); localStorage.removeItem(AI_HISTORY_STORAGE_KEY); }} className="text-xs text-slate-400 hover:text-rose-200">{t('clearHistory')}</button></div>{aiHistory.length ? <div className="space-y-2">{aiHistory.slice(0, 6).map((item) => <button key={item.id} onClick={() => { const restored: Preset = { ...item.preset, id: `history-${item.id}`, source: 'ai', tags: ['ai', 'history'] }; persistPresets([...presets, restored]); selectPreset(restored); setToast(t('historyRestored')); }} className="w-full rounded-xl border border-white/10 bg-black/15 p-3 text-left hover:border-indigo-300/40"><div className="flex items-center justify-between gap-2 text-xs text-white"><span className="truncate">{item.prompt}</span><span className="shrink-0 text-slate-500">{new Date(item.createdAt).toLocaleDateString(locale)}</span></div><div className="mt-1 text-[11px] text-slate-500">{item.provider} · {item.model}</div></button>)}</div> : <p className="text-xs text-slate-500">{t('historyEmpty')}</p>}</div>}
                  <div className="rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-indigo-400/10 to-cyan-300/5 p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-indigo-200" />{t('aiTitle')}</div><button onClick={() => setPanel('settings')} className="rounded-lg border border-indigo-300/20 px-2.5 py-1 text-[11px] text-indigo-100 hover:bg-indigo-300/10">{t('aiPoweredBy')} {getAIProvider(settings.aiProvider).name} · {settings.aiModel}</button></div><div className="flex flex-col gap-2 sm:flex-row"><input value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && generatePreset()} placeholder={t('aiHint')} className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-indigo-300/70" /><button disabled={aiGenerating || !aiPrompt.trim()} onClick={generatePreset} className="rounded-xl bg-indigo-300 px-4 py-3 text-sm font-semibold text-[#0b1020] disabled:opacity-40">{aiGenerating ? t('generating') : t('generate')}<Wand2 className="ml-2 inline h-4 w-4" /></button></div>{aiError && <p className="mt-3 text-xs text-rose-300"><AlertCircle className="mr-1 inline h-4 w-4" />{aiError}</p>}</div>
                  <div className="flex justify-between"><button onClick={() => setStep(0)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><ArrowLeft className="mr-2 inline h-4 w-4" />{t('back')}</button><button onClick={() => setStep(2)} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0b1020]">{t('continue')}<ArrowRight className="ml-2 inline h-4 w-4" /></button></div>
                </section>}

                {step === 2 && <section className="space-y-5">
                  <div className="grid gap-4 rounded-2xl border border-white/10 bg-[#111a30] p-5 sm:grid-cols-2"><Field label={t('format')}><select value={customFormat} onChange={(event) => setCustomFormat(event.target.value as PresetSettings['format'])}><option value="mp4">MP4</option><option value="webm">WebM</option><option value="gif">GIF</option><option value="mp3">MP3</option><option value="mkv">MKV</option></select></Field><Field label={t('videoCodec')}><select value={customVcodec} onChange={(event) => setCustomVcodec(event.target.value as PresetSettings['vcodec'])}><option value="h264">H.264</option><option value="vp9">VP9</option><option value="hevc">HEVC</option><option value="gif">GIF</option><option value="none">None</option></select></Field><Field label={t('resolution')}><select value={customResolution} onChange={(event) => setCustomResolution(event.target.value as PresetSettings['resolution'])}><option value="original">Original</option><option value="1080p">1080p</option><option value="720p">720p</option><option value="480p">480p</option><option value="360p">360p</option></select></Field><Field label={t('frameRate')}><select value={customFps} onChange={(event) => setCustomFps(Number(event.target.value))}><option value="60">60 FPS</option><option value="30">30 FPS</option><option value="24">24 FPS</option><option value="15">15 FPS</option><option value="12">12 FPS</option></select></Field><Field label={t('bitrate')}><select value={customVbitrate} onChange={(event) => setCustomVbitrate(event.target.value)}><option value="auto">Auto</option><option value="5000k">5 Mbps</option><option value="2500k">2.5 Mbps</option><option value="1200k">1.2 Mbps</option><option value="500k">500 Kbps</option></select></Field><div><span className="mb-2 block text-xs text-slate-400">{t('audioTrack')}</span><button onClick={() => setCustomAudioEnabled((value) => !value)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${customAudioEnabled ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-black/20 text-slate-500'}`}>{customAudioEnabled ? t('enabled') : t('muted')}{customAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div></div>
                  <details className="rounded-2xl border border-white/10 bg-[#111a30] p-5"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">{t('advanced')}<ChevronDown className="h-4 w-4 text-slate-500" /></summary><textarea value={customArgs} onChange={(event) => setCustomArgs(event.target.value)} rows={3} className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-300/60" /></details>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row"><button onClick={saveCustomPreset} className="rounded-xl border border-cyan-300/20 px-4 py-3 text-sm text-cyan-100 hover:bg-cyan-300/10">{t('savePreset')}</button><div className="flex gap-2"><button onClick={() => setStep(1)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><ArrowLeft className="mr-2 inline h-4 w-4" />{t('back')}</button><button disabled={transcoding || !selectedFile} onClick={handleTranscode} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0b1020] disabled:opacity-40">{transcoding ? t('processing') : t('startTranscode')}<ArrowRight className="ml-2 inline h-4 w-4" /></button></div></div>
                  {transcoding && <div className="rounded-xl border border-white/10 bg-[#111a30] p-4"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>{t('processing')}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-cyan-300 to-indigo-400" animate={{ width: `${progress}%` }} /></div></div>}
                </section>}

                {step === 3 && <section className="space-y-5">
                  {outputUrl ? <div className="overflow-hidden rounded-3xl border border-emerald-300/30 bg-emerald-300/5"><div className="flex items-center gap-3 border-b border-emerald-300/20 p-5"><CheckCircle2 className="h-6 w-6 text-emerald-200" /><div><h2 className="font-semibold text-white">{t('complete')}</h2><p className="text-xs text-slate-400">{outputName} · {outputSize} {elapsed ? `· ${elapsed}s ${t('elapsed')}` : ''}</p></div></div><div className="aspect-video bg-black"><video src={outputUrl} controls autoPlay className="h-full w-full object-contain" /></div><a href={outputUrl} download={outputName} className="m-5 block rounded-xl bg-emerald-300 px-4 py-3 text-center text-sm font-semibold text-[#0b1020]"><Download className="mr-2 inline h-4 w-4" />{t('download')}</a></div> : <div className="rounded-3xl border border-dashed border-white/10 bg-[#111a30] p-12 text-center text-sm text-slate-500">{t('emptyOutput')}</div>}<button onClick={() => setStep(0)} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><ArrowLeft className="mr-2 inline h-4 w-4" />{t('importStep')}</button></section>}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        <footer className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111a30] p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><span className={`h-2 w-2 rounded-full ${typeof navigator !== 'undefined' && navigator.onLine ? 'bg-cyan-300' : 'bg-amber-300'}`} />{typeof navigator !== 'undefined' && navigator.onLine ? t('online') : t('offline')} · {t('engine')}: {engine === 'ffmpeg' ? t('ffmpegEngine') : t('nativeEngine')} · AI: {getAIProvider(settings.aiProvider).name} / {settings.aiModel}</div><button onClick={() => setShowDiagnostics((value) => !value)} className="text-left hover:text-slate-300">{t('diagnostics')} <ChevronDown className="ml-1 inline h-3.5 w-3.5" /></button></footer>
        {showDiagnostics && <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-[11px] text-slate-500"><div className="mb-2 flex justify-between"><span>{logs.length} events</span><button onClick={() => setLogs([])}>{t('clear')}</button></div>{logs.map((item, index) => <div key={`${item}-${index}`} className="border-l border-cyan-300/20 py-0.5 pl-2">{item}</div>)}</div>}
      </div>

      <AnimatePresence>
        {panel && <><motion.button aria-label={t('close')} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setPanel(null)} {...(reduceMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } })} /><motion.aside className="fixed right-0 top-0 z-40 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#111a30] p-5 shadow-2xl" {...(reduceMotion ? {} : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: { type: 'spring', damping: 28, stiffness: 260 } })}><div className="mb-8 flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{panel === 'guide' ? t('guide') : t('settingsTitle')}</h2><button onClick={() => setPanel(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div>{panel === 'guide' ? <Guide t={t} /> : <SettingsPanel t={t} settings={settings} ffmpeg={ffmpeg} ffmpegLoading={ffmpegLoading} ffmpegError={ffmpegError} onUpdate={updateSettings} onLoad={loadFFmpeg} onToast={setToast} onClearPresets={() => { localStorage.removeItem(PRESETS_STORAGE_KEY); localStorage.removeItem('ocularmp4.presets.v1'); setPresets(DEFAULT_PRESETS); setToast(t('clearPresets')); }} />}</motion.aside></>}
      </AnimatePresence>
      <AnimatePresence>{toast && <motion.div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-300/30 bg-[#14213d] px-4 py-3 text-sm text-cyan-100 shadow-xl" {...(reduceMotion ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 } })}>{toast}</motion.div>}</AnimatePresence>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-slate-400"><span className="mb-2 block">{label}</span><span className="block [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-white/10 [&>select]:bg-black/20 [&>select]:px-3 [&>select]:py-2.5 [&>select]:text-sm [&>select]:text-white [&>select]:outline-none">{children}</span></label>;
}

function Guide({ t }: { t: (key: TranslationKey) => string }) {
  const cards = [['guideImport', 'guideImportBody', FileVideo], ['guidePreset', 'guidePresetBody', Layers3], ['guideEngine', 'guideEngineBody', Cpu], ['guideExport', 'guideExportBody', Download]] as const;
  return <div className="space-y-4"><p className="text-sm leading-relaxed text-slate-400">{t('guideIntro')}</p>{cards.map(([title, body, Icon]) => <div key={title} className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="mb-3 h-5 w-5 text-cyan-200" /><h3 className="mb-1 text-sm font-semibold text-white">{t(title as TranslationKey)}</h3><p className="text-xs leading-relaxed text-slate-400">{t(body as TranslationKey)}</p></div>)}<div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4"><ShieldCheck className="mb-3 h-5 w-5 text-cyan-200" /><h3 className="mb-1 text-sm font-semibold text-white">{t('guidePrivacy')}</h3><p className="text-xs leading-relaxed text-slate-400">{t('guidePrivacyBody')}</p></div></div>;
}
