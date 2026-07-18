import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider, type AIProvider } from '../../../../lib/ai-providers';

function modelsEndpoint(provider: AIProvider) {
  const definition = getAIProvider(provider);
  if (provider === 'openai') return definition.endpoint.replace(/\/responses\/?$/, '/models');
  if (provider === 'gemini') return `${definition.endpoint}/models`;
  if (provider === 'anthropic') return definition.endpoint.replace(/\/messages\/?$/, '/models');
  return definition.endpoint.replace(/\/chat\/completions\/?$/, '/models');
}

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json() as { provider: AIProvider; apiKey: string };
    const definition = getAIProvider(provider);
    if (definition.direct) return NextResponse.json({ error: 'Local providers must be tested directly.' }, { status: 400 });
    if (definition.requiresKey && !apiKey) return NextResponse.json({ error: 'API key is required.' }, { status: 400 });

    const headers: Record<string, string> = {};
    let endpoint = modelsEndpoint(provider);
    if (provider === 'gemini') endpoint += `?key=${encodeURIComponent(apiKey)}`;
    else if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, { headers });
    if (!response.ok) return NextResponse.json({ error: `Provider returned ${response.status}.` }, { status: 502 });
    return NextResponse.json({ ok: true, provider });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Connection failed.' }, { status: 502 });
  }
}
