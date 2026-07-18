export type AIProvider =
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'anthropic'
  | 'openrouter'
  | 'together'
  | 'mistral'
  | 'deepseek'
  | 'ollama'
  | 'custom';

export interface AIProviderDefinition {
  id: AIProvider;
  name: string;
  endpoint: string;
  defaultModel: string;
  requiresKey: boolean;
  direct: boolean;
  protocol: 'responses' | 'gemini' | 'anthropic' | 'openai-compatible' | 'ollama';
}

export const AI_PROVIDERS: AIProviderDefinition[] = [
  { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1/responses', defaultModel: 'gpt-5.6-sol', requiresKey: true, direct: false, protocol: 'responses' },
  { id: 'gemini', name: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.5-flash', requiresKey: true, direct: false, protocol: 'gemini' },
  { id: 'groq', name: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile', requiresKey: true, direct: false, protocol: 'openai-compatible' },
  { id: 'anthropic', name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1/messages', defaultModel: 'claude-sonnet-4-5', requiresKey: true, direct: false, protocol: 'anthropic' },
  { id: 'openrouter', name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'openai/gpt-4.1-mini', requiresKey: true, direct: false, protocol: 'openai-compatible' },
  { id: 'together', name: 'Together AI', endpoint: 'https://api.together.xyz/v1/chat/completions', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', requiresKey: true, direct: false, protocol: 'openai-compatible' },
  { id: 'mistral', name: 'Mistral AI', endpoint: 'https://api.mistral.ai/v1/chat/completions', defaultModel: 'mistral-small-latest', requiresKey: true, direct: false, protocol: 'openai-compatible' },
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-chat', requiresKey: true, direct: false, protocol: 'openai-compatible' },
  { id: 'ollama', name: 'Ollama (local)', endpoint: 'http://localhost:11434/api/chat', defaultModel: 'llama3.2', requiresKey: false, direct: true, protocol: 'ollama' },
  { id: 'custom', name: 'Custom OpenAI-compatible', endpoint: 'http://localhost:1234/v1/chat/completions', defaultModel: 'local-model', requiresKey: false, direct: true, protocol: 'openai-compatible' },
];

export function getAIProvider(provider: AIProvider) {
  return AI_PROVIDERS.find((item) => item.id === provider) || AI_PROVIDERS[0];
}

export const PRESET_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'category', 'ffmpegArgs', 'settings'],
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    category: { type: 'string', enum: ['compatible', 'size', 'hq', 'audio', 'gif', 'custom'] },
    ffmpegArgs: { type: 'array', items: { type: 'string' } },
    settings: {
      type: 'object',
      additionalProperties: false,
      required: ['format', 'vcodec', 'acodec', 'resolution', 'fps', 'vbitrate', 'abitrate', 'audioEnabled', 'volume'],
      properties: {
        format: { type: 'string', enum: ['mp4', 'webm', 'gif', 'mp3', 'aac', 'mkv'] },
        vcodec: { type: 'string', enum: ['h264', 'vp9', 'hevc', 'av1', 'gif', 'none'] },
        acodec: { type: 'string', enum: ['aac', 'opus', 'mp3', 'none'] },
        resolution: { type: 'string', enum: ['1080p', '720p', '480p', '360p', 'original'] },
        fps: { type: 'integer' },
        vbitrate: { type: 'string' },
        abitrate: { type: 'string' },
        audioEnabled: { type: 'boolean' },
        volume: { type: 'number' },
      },
    },
  },
} as const;

export function buildPresetInstructions(locale: 'en' | 'id') {
  const language = locale === 'id' ? 'Bahasa Indonesia' : 'English';
  return `Role: You are a video transcoding and FFmpeg preset expert.

Goal: Convert the user's request into one safe, practical encoding preset.

Success criteria:
- Return exactly the required JSON object and no prose outside it.
- Write name and description in ${language}.
- Keep codecs, formats, and FFmpeg arguments in their standard technical form.
- Use only schema enum values.
- Do not include an input file, output file, shell command, pipe, or network URL in ffmpegArgs.
- Prefer broadly supported FFmpeg.wasm arguments.
- For strict file-size requests, lower resolution and bitrate conservatively.

Stop after producing the complete JSON object.`;
}

export function validatePresetData(value: any) {
  const formats = ['mp4', 'webm', 'gif', 'mp3', 'aac', 'mkv'];
  const videoCodecs = ['h264', 'vp9', 'hevc', 'av1', 'gif', 'none'];
  const audioCodecs = ['aac', 'opus', 'mp3', 'none'];
  const resolutions = ['1080p', '720p', '480p', '360p', 'original'];
  const categories = ['compatible', 'size', 'hq', 'audio', 'gif', 'custom'];
  if (!value || typeof value !== 'object') throw new Error('Preset response is not an object.');
  if (typeof value.name !== 'string' || typeof value.description !== 'string') throw new Error('Preset name or description is missing.');
  if (!categories.includes(value.category)) throw new Error('Preset category is invalid.');
  if (!Array.isArray(value.ffmpegArgs) || !value.ffmpegArgs.every((item: unknown) => typeof item === 'string')) throw new Error('FFmpeg arguments are invalid.');
  if (value.ffmpegArgs.some((item: string) => item === '-i' || /^(https?|file|pipe|concat):/i.test(item))) throw new Error('Preset contains an unsafe input argument.');
  const settings = value.settings;
  if (!settings || !formats.includes(settings.format) || !videoCodecs.includes(settings.vcodec) || !audioCodecs.includes(settings.acodec) || !resolutions.includes(settings.resolution)) throw new Error('Preset settings contain unsupported values.');
  if (!Number.isInteger(settings.fps) || settings.fps < 1 || settings.fps > 120) throw new Error('Preset frame rate is invalid.');
  if (typeof settings.audioEnabled !== 'boolean' || typeof settings.volume !== 'number' || settings.volume < 0 || settings.volume > 4) throw new Error('Preset audio settings are invalid.');
  return value;
}

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model did not return a JSON object.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function generateDirectPreset(args: {
  provider: AIProvider;
  endpoint: string;
  model: string;
  apiKey: string;
  prompt: string;
  locale: 'en' | 'id';
}) {
  const definition = getAIProvider(args.provider);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (args.apiKey) headers.Authorization = `Bearer ${args.apiKey}`;
  const instructions = buildPresetInstructions(args.locale);

  if (definition.protocol === 'ollama') {
    const response = await fetch(args.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: args.model,
        stream: false,
        format: PRESET_JSON_SCHEMA,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: args.prompt },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Ollama returned ${response.status}.`);
    return validatePresetData(extractJson(data.message?.content || data.response || ''));
  }

  const response = await fetch(args.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: args.prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || data.error || `Endpoint returned ${response.status}.`);
  return validatePresetData(extractJson(data.choices?.[0]?.message?.content || ''));
}

export async function testDirectProvider(args: {
  provider: AIProvider;
  endpoint: string;
  apiKey: string;
}) {
  const definition = getAIProvider(args.provider);
  const headers: Record<string, string> = {};
  if (args.apiKey) headers.Authorization = `Bearer ${args.apiKey}`;
  const endpoint = definition.protocol === 'ollama'
    ? args.endpoint.replace(/\/api\/chat\/?$/, '/api/tags')
    : args.endpoint.replace(/\/chat\/completions\/?$/, '/models');
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`Connection returned ${response.status}.`);
  return true;
}
