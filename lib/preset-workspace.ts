import { validatePresetData } from './ai-providers';

export interface PresetSettings {
  format: 'mp4' | 'webm' | 'gif' | 'mp3' | 'aac' | 'mkv';
  vcodec: 'h264' | 'vp9' | 'hevc' | 'gif' | 'none';
  acodec: 'aac' | 'opus' | 'mp3' | 'none';
  resolution: '1080p' | '720p' | '480p' | '360p' | 'original';
  fps: number;
  vbitrate: string;
  abitrate: string;
  audioEnabled: boolean;
  volume: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  category: 'compatible' | 'size' | 'hq' | 'audio' | 'gif' | 'custom';
  ffmpegArgs: string[];
  settings: PresetSettings;
  favorite?: boolean;
  tags?: string[];
  source?: 'built-in' | 'custom' | 'ai' | 'imported';
}

export interface AIHistoryItem {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  createdAt: string;
  preset: Omit<Preset, 'id' | 'favorite' | 'tags' | 'source'>;
}

export interface ConversionHistoryItem {
  id: string;
  fileName: string;
  outputName?: string;
  outputSize?: string;
  status: 'completed' | 'failed' | 'cancelled';
  engine: 'native' | 'ffmpeg';
  presetName: string;
  preset: Preset;
  createdAt: string;
  error?: string;
}

export const PRESETS_STORAGE_KEY = 'ocularmp4.presets.v2';
export const LEGACY_PRESETS_STORAGE_KEY = 'ocularmp4.presets.v1';
export const AI_HISTORY_STORAGE_KEY = 'ocularmp4.ai-history.v1';
export const CONVERSION_HISTORY_STORAGE_KEY = 'ocularmp4.conversion-history.v1';
export const WORKSPACE_SCHEMA_VERSION = 2;

function cleanPreset(value: unknown, source: Preset['source'] = 'imported'): Preset {
  const validated = validatePresetData(value) as Omit<Preset, 'id'>;
  const candidate = (value || {}) as Partial<Preset>;
  return {
    ...validated,
    id: typeof candidate.id === 'string' ? candidate.id : `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    favorite: Boolean(candidate.favorite),
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12) : [],
    source,
  };
}

export function readStoredPresets(defaults: Preset[]): Preset[] {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY) || localStorage.getItem(LEGACY_PRESETS_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return defaults;
    const stored = parsed.map((item) => cleanPreset(item, item?.source === 'ai' ? 'ai' : 'custom'));
    const mergedDefaults = defaults.map((base) => {
      const metadata = stored.find((item) => item.id === base.id);
      return metadata ? { ...base, favorite: metadata.favorite, tags: metadata.tags } : base;
    });
    return [...mergedDefaults, ...stored.filter((item) => !defaults.some((base) => base.id === item.id))];
  } catch {
    return defaults;
  }
}

export function writeStoredPresets(presets: Preset[], defaults: Preset[]) {
  if (typeof window === 'undefined') return;
  const stored = presets
    .filter((item) => !defaults.some((base) => base.id === item.id) || item.favorite || item.tags?.length)
    .map((item) => ({ ...item, source: defaults.some((base) => base.id === item.id) ? 'built-in' : item.source || 'custom' }));
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(stored));
  localStorage.removeItem(LEGACY_PRESETS_STORAGE_KEY);
}

export function parseImportedPresets(text: string): Preset[] {
  const parsed = JSON.parse(text);
  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.presets) ? parsed.presets : [parsed];
  if (!entries.length || entries.length > 100) throw new Error('Import must contain between 1 and 100 presets.');
  return (entries as unknown[]).map((item) => cleanPreset(item, 'imported'));
}

export function readAIHistory(): AIHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_HISTORY_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function writeAIHistory(items: AIHistoryItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
}

export function readConversionHistory(): ConversionHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CONVERSION_HISTORY_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function writeConversionHistory(items: ConversionHistoryItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONVERSION_HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
}
