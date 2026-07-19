import { getAIProvider, type AIProvider } from './ai-providers';

export const SETTINGS_KEY = 'ocularmp4.settings.v2';
export const LEGACY_SETTINGS_KEY = 'ocularmp4.settings.v1';
export const PRESETS_KEY = 'ocularmp4.presets.v1';
export const SETTINGS_SCHEMA_VERSION = 2;
export const AI_CREDENTIALS_SESSION_KEY = 'ocularmp4.ai-credentials.session.v1';
export const AI_CREDENTIALS_LOCAL_KEY = 'ocularmp4.ai-credentials.local.v1';

export type Theme = 'system' | 'dark' | 'light';
export type MotionPreference = 'system' | 'full' | 'reduced';

export interface AppSettings {
  schemaVersion: number;
  locale: 'en' | 'id';
  theme: Theme;
  motion: MotionPreference;
  defaultEngine: 'native' | 'ffmpeg';
  ffmpegBuild: 'standard' | 'heavy';
  advancedMode: boolean;
  aiProvider: AIProvider;
  aiModel: string;
  aiEndpoint: string;
  rememberApiKey: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  locale: 'en',
  theme: 'dark',
  motion: 'system',
  defaultEngine: 'native',
  ffmpegBuild: 'standard',
  advancedMode: false,
  aiProvider: 'openai',
  aiModel: getAIProvider('openai').defaultModel,
  aiEndpoint: getAIProvider('openai').endpoint,
  rememberApiKey: false,
};

export function readSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const current = localStorage.getItem(SETTINGS_KEY);
    const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
    const parsed = JSON.parse(current || legacy || 'null');
    const provider = (parsed?.aiProvider || DEFAULT_SETTINGS.aiProvider) as AIProvider;
    const definition = getAIProvider(provider);
    return {
      ...DEFAULT_SETTINGS,
      ...(parsed || {}),
      aiProvider: provider,
      aiModel: parsed?.aiModel || definition.defaultModel,
      aiEndpoint: parsed?.aiEndpoint || definition.endpoint,
      schemaVersion: SETTINGS_SCHEMA_VERSION,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: AppSettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, schemaVersion: SETTINGS_SCHEMA_VERSION }));
  }
}

function readCredentialStore(storage: Storage, key: string) {
  try {
    return JSON.parse(storage.getItem(key) || '{}') as Partial<Record<AIProvider, string>>;
  } catch {
    return {};
  }
}

export function readAICredential(provider: AIProvider) {
  if (typeof window === 'undefined') return '';
  const session = readCredentialStore(sessionStorage, AI_CREDENTIALS_SESSION_KEY);
  const local = readCredentialStore(localStorage, AI_CREDENTIALS_LOCAL_KEY);
  return session[provider] || local[provider] || '';
}

export function writeAICredential(provider: AIProvider, apiKey: string, remember: boolean) {
  if (typeof window === 'undefined') return;
  const session = readCredentialStore(sessionStorage, AI_CREDENTIALS_SESSION_KEY);
  const local = readCredentialStore(localStorage, AI_CREDENTIALS_LOCAL_KEY);
  delete session[provider];
  delete local[provider];
  if (apiKey) {
    if (remember) local[provider] = apiKey;
    else session[provider] = apiKey;
  }
  sessionStorage.setItem(AI_CREDENTIALS_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(AI_CREDENTIALS_LOCAL_KEY, JSON.stringify(local));
}

export function clearAllAICredentials() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AI_CREDENTIALS_SESSION_KEY);
  localStorage.removeItem(AI_CREDENTIALS_LOCAL_KEY);
}
