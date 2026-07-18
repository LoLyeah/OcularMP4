import { NextRequest, NextResponse } from 'next/server';
import {
  PRESET_JSON_SCHEMA,
  buildPresetInstructions,
  getAIProvider,
  validatePresetData,
  type AIProvider,
} from '../../../../lib/ai-providers';

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The provider did not return a JSON object.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function readProviderError(response: Response) {
  try {
    const data = await response.json();
    return data.error?.message || data.error || data.message || `Provider returned ${response.status}.`;
  } catch {
    return `Provider returned ${response.status}.`;
  }
}

async function callOpenAI(apiKey: string, model: string, prompt: string, locale: 'en' | 'id') {
  const body: Record<string, unknown> = {
    model,
    instructions: buildPresetInstructions(locale),
    input: prompt,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'video_preset',
        strict: true,
        schema: PRESET_JSON_SCHEMA,
      },
    },
  };
  if (model.startsWith('gpt-5')) body.reasoning = { effort: 'none' };
  const response = await fetch(getAIProvider('openai').endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readProviderError(response));
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === 'output_text')?.text || '';
  return extractJson(text);
}

async function callGemini(apiKey: string, model: string, prompt: string, locale: 'en' | 'id') {
  const base = getAIProvider('gemini').endpoint;
  const response = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildPresetInstructions(locale) }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: PRESET_JSON_SCHEMA,
      },
    }),
  });
  if (!response.ok) throw new Error(await readProviderError(response));
  const data = await response.json();
  return extractJson(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

async function callAnthropic(apiKey: string, model: string, prompt: string, locale: 'en' | 'id') {
  const response = await fetch(getAIProvider('anthropic').endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      temperature: 0.2,
      system: buildPresetInstructions(locale),
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(await readProviderError(response));
  const data = await response.json();
  return extractJson(data.content?.find((item: any) => item.type === 'text')?.text || '');
}

async function callCompatible(provider: AIProvider, apiKey: string, model: string, prompt: string, locale: 'en' | 'id') {
  const definition = getAIProvider(provider);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://ocularmp4-studio.openai.site';
    headers['X-Title'] = 'Encode.Core';
  }
  const response = await fetch(definition.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildPresetInstructions(locale) },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(await readProviderError(response));
  const data = await response.json();
  return extractJson(data.choices?.[0]?.message?.content || '');
}

export async function POST(request: NextRequest) {
  try {
    const { provider, model, apiKey, prompt, locale = 'en' } = await request.json() as {
      provider: AIProvider;
      model: string;
      apiKey: string;
      prompt: string;
      locale?: 'en' | 'id';
    };
    const definition = getAIProvider(provider);
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    if (!model?.trim()) return NextResponse.json({ error: 'Model is required.' }, { status: 400 });
    if (definition.direct) return NextResponse.json({ error: 'Local providers must connect directly from the browser.' }, { status: 400 });
    if (definition.requiresKey && !apiKey) return NextResponse.json({ error: 'API key is required.' }, { status: 400 });

    let preset;
    if (provider === 'openai') preset = await callOpenAI(apiKey, model, prompt, locale);
    else if (provider === 'gemini') preset = await callGemini(apiKey, model, prompt, locale);
    else if (provider === 'anthropic') preset = await callAnthropic(apiKey, model, prompt, locale);
    else preset = await callCompatible(provider, apiKey, model, prompt, locale);

    return NextResponse.json({ schemaVersion: 1, provider, model, preset: validatePresetData(preset) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'AI preset generation failed.' }, { status: 502 });
  }
}
