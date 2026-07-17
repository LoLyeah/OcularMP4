export const SETTINGS_KEY = 'ocularmp4.settings.v1';
export const PRESETS_KEY = 'ocularmp4.presets.v1';
export const SETTINGS_SCHEMA_VERSION = 1;

export type Theme = 'system' | 'dark' | 'light';
export type MotionPreference = 'system' | 'full' | 'reduced';

export interface AppSettings {
  schemaVersion: number;
  locale: 'en' | 'id';
  theme: Theme;
  motion: MotionPreference;
  defaultEngine: 'native' | 'ffmpeg';
  advancedMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  locale: 'en',
  theme: 'dark',
  motion: 'system',
  defaultEngine: 'native',
  advancedMode: false,
};

export function readSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return { ...DEFAULT_SETTINGS, ...(parsed || {}), schemaVersion: SETTINGS_SCHEMA_VERSION };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: AppSettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, schemaVersion: SETTINGS_SCHEMA_VERSION }));
  }
}
