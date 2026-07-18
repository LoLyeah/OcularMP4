'use client';

import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Server, ShieldCheck, Trash2 } from 'lucide-react';
import { AI_PROVIDERS, getAIProvider, testDirectProvider, type AIProvider } from '../lib/ai-providers';
import {
  clearAllAICredentials,
  readAICredential,
  writeAICredential,
  type AppSettings,
} from '../lib/settings';
import type { TranslationKey } from '../lib/i18n';

interface SettingsPanelProps {
  t: (key: TranslationKey) => string;
  settings: AppSettings;
  ffmpeg: unknown;
  ffmpegLoading: boolean;
  ffmpegError: string;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onLoad: () => void;
  onClearPresets: () => void;
  onToast: (message: string) => void;
}

export function SettingsPanel({
  t,
  settings,
  ffmpeg,
  ffmpegLoading,
  ffmpegError,
  onUpdate,
  onLoad,
  onClearPresets,
  onToast,
}: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState(() => readAICredential(settings.aiProvider));
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ready' | 'failed'>('idle');
  const provider = getAIProvider(settings.aiProvider);

  const changeProvider = (nextProvider: AIProvider) => {
    const definition = getAIProvider(nextProvider);
    onUpdate({
      aiProvider: nextProvider,
      aiModel: definition.defaultModel,
      aiEndpoint: definition.endpoint,
    });
    setApiKey(readAICredential(nextProvider));
    setConnectionStatus('idle');
  };

  const updateKey = (value: string, remember = settings.rememberApiKey) => {
    setApiKey(value);
    writeAICredential(settings.aiProvider, value, remember);
    setConnectionStatus('idle');
  };

  const testConnection = async () => {
    if (provider.requiresKey && !apiKey) {
      setConnectionStatus('failed');
      onToast(t('apiKeyRequired'));
      return;
    }
    setTesting(true);
    setConnectionStatus('idle');
    try {
      if (provider.direct) {
        await testDirectProvider({
          provider: settings.aiProvider,
          endpoint: settings.aiEndpoint,
          apiKey,
        });
      } else {
        const response = await fetch('/api/ai/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: settings.aiProvider, apiKey }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('connectionFailed'));
      }
      setConnectionStatus('ready');
      onToast(t('connectionReady'));
    } catch {
      setConnectionStatus('failed');
      onToast(t('connectionFailed'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>{t('general')}</SectionTitle>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-300">{t('language')}</span>
            <div className="flex rounded-lg bg-black/20 p-0.5">
              {(['en', 'id'] as const).map((locale) => (
                <button
                  key={locale}
                  onClick={() => onUpdate({ locale })}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${settings.locale === locale ? 'bg-cyan-300 text-[#0b1020]' : 'text-slate-400'}`}
                >
                  {locale.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <SettingSelect
            label={t('theme')}
            value={settings.theme}
            options={[['system', t('system')], ['dark', t('dark')], ['light', t('light')]]}
            onChange={(value) => onUpdate({ theme: value as AppSettings['theme'] })}
          />
          <SettingSelect
            label={t('motion')}
            value={settings.motion}
            options={[['system', t('system')], ['full', t('fullMotion')], ['reduced', t('reducedMotion')]]}
            onChange={(value) => onUpdate({ motion: value as AppSettings['motion'] })}
          />
        </div>
      </section>

      <section>
        <SectionTitle>{t('aiSettings')}</SectionTitle>
        <div className="space-y-4 rounded-2xl border border-indigo-300/20 bg-indigo-300/5 p-4">
          <label className="block text-xs text-slate-400">
            <span className="mb-2 block">{t('aiProvider')}</span>
            <select
              value={settings.aiProvider}
              onChange={(event) => changeProvider(event.target.value as AIProvider)}
              className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-300/60"
            >
              {AI_PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            <span className="mb-2 block">{t('aiModel')}</span>
            <input
              value={settings.aiModel}
              onChange={(event) => onUpdate({ aiModel: event.target.value })}
              spellCheck={false}
              className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-indigo-300/60"
            />
          </label>

          <label className="block text-xs text-slate-400">
            <span className="mb-2 block">{t('aiEndpoint')}</span>
            <div className="relative">
              <Server className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                value={settings.aiEndpoint}
                disabled={!provider.direct}
                onChange={(event) => onUpdate({ aiEndpoint: event.target.value })}
                spellCheck={false}
                className="w-full rounded-xl border border-white/10 bg-[#0b1020] py-2.5 pl-10 pr-3 font-mono text-[11px] text-white outline-none disabled:cursor-not-allowed disabled:text-slate-500"
              />
            </div>
            {settings.aiProvider === 'custom' && <span className="mt-1.5 block text-[11px] text-slate-500">{t('customEndpointHelp')}</span>}
          </label>

          {provider.requiresKey || settings.aiProvider === 'custom' ? (
            <label className="block text-xs text-slate-400">
              <span className="mb-2 block">{t('aiApiKey')}</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => updateKey(event.target.value)}
                  placeholder={t('apiKeyPlaceholder')}
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/10 bg-[#0b1020] py-2.5 pl-10 pr-10 text-sm text-white outline-none focus:border-indigo-300/60"
                />
                <button type="button" aria-label={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey((value) => !value)} className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-500 hover:text-white">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          ) : null}

          {provider.requiresKey || settings.aiProvider === 'custom' ? (
            <label className="flex cursor-pointer items-start gap-3 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={settings.rememberApiKey}
                onChange={(event) => {
                  onUpdate({ rememberApiKey: event.target.checked });
                  writeAICredential(settings.aiProvider, apiKey, event.target.checked);
                }}
                className="mt-0.5 accent-indigo-300"
              />
              <span><strong className="block font-medium text-slate-300">{t('rememberApiKey')}</strong>{t('apiKeySessionNote')}</span>
            </label>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-[11px] leading-relaxed text-slate-500">
            <ShieldCheck className="mb-1.5 h-4 w-4 text-indigo-200" />
            {provider.direct ? t('directProviderNote') : t('cloudProxyNote')}
          </div>

          <button
            onClick={testConnection}
            disabled={testing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300/30 px-3 py-2.5 text-sm font-medium text-indigo-100 hover:bg-indigo-300/10 disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : connectionStatus === 'ready' ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Server className="h-4 w-4" />}
            {testing ? t('testingConnection') : connectionStatus === 'ready' ? t('connectionReady') : connectionStatus === 'failed' ? t('connectionFailed') : t('testConnection')}
          </button>
        </div>
      </section>

      <section>
        <SectionTitle>{t('processingSettings')}</SectionTitle>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
          <SettingSelect
            label={t('defaultEngine')}
            value={settings.defaultEngine}
            options={[['native', t('nativeEngine')], ['ffmpeg', t('ffmpegEngine')]]}
            onChange={(value) => onUpdate({ defaultEngine: value as AppSettings['defaultEngine'] })}
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-300">{t('loadFfmpeg')}</span>
            <button disabled={ffmpegLoading || Boolean(ffmpeg)} onClick={onLoad} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#0b1020] disabled:opacity-40">
              {ffmpeg ? t('compilerLoaded') : ffmpegLoading ? t('processing') : t('loadFfmpegButton')}
            </button>
          </div>
          {ffmpegError && <p className="text-xs text-rose-300">{ffmpegError}</p>}
        </div>
      </section>

      <section>
        <SectionTitle>{t('storage')}</SectionTitle>
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/15 p-4">
          <button onClick={onClearPresets} className="flex w-full items-center gap-2 rounded-xl border border-rose-300/20 px-3 py-2.5 text-left text-sm text-rose-200 hover:bg-rose-300/10">
            <Trash2 className="h-4 w-4" />{t('clearPresets')}
          </button>
          <button
            onClick={() => {
              clearAllAICredentials();
              setApiKey('');
              setConnectionStatus('idle');
              onToast(t('clearApiKeys'));
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-rose-300/20 px-3 py-2.5 text-left text-sm text-rose-200 hover:bg-rose-300/10"
          >
            <KeyRound className="h-4 w-4" />{t('clearApiKeys')}
          </button>
        </div>
      </section>

      <div className="border-t border-white/10 pt-5 text-xs text-slate-500">
        <div className="flex justify-between"><span>{t('version')}</span><span className="text-slate-300">0.3.1</span></div>
        <div className="mt-2 flex justify-between"><span>{t('build')}</span><span className="font-mono text-slate-400">provider-milestone</span></div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{children}</h3>;
}

function SettingSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm text-slate-300">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b1020] px-2.5 py-2 text-xs text-white outline-none">
        {options.map(([option, labelText]) => <option key={option} value={option}>{labelText}</option>)}
      </select>
    </label>
  );
}
