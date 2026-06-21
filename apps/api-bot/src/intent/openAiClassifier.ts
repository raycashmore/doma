import type { IntentClassifierInput, IntentClassifierProvider } from './classifier.js';
import { intentRouterOutputJsonSchema } from './classifier.js';
import type { IntentDescriptorRegistry } from './registry.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function openAiMessageContent(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.choices)) return null;
  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === 'string' ? firstChoice.message.content : null;
}

/**
 * The real intent classifier provider. Mirrors the morning-briefing AI module's
 * pattern: a strict JSON-schema structured response and a typed throw on a
 * non-2xx status or missing content. The router (`classifyIntent`) owns the
 * deterministic fallback to `none`, so this provider stays a thin transport.
 */
export function createOpenAiIntentClassifierProvider({
  apiKey,
  model,
  descriptors,
  fetchImpl = fetch
}: {
  apiKey: string;
  model: string;
  descriptors: IntentDescriptorRegistry;
  fetchImpl?: typeof fetch;
}): IntentClassifierProvider {
  const schema = intentRouterOutputJsonSchema(descriptors);

  return async (input: IntentClassifierInput) => {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: input.prompt },
          { role: 'user', content: input.messageText }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'intent_router',
            strict: true,
            schema
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Intent router AI request failed with status ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    const content = openAiMessageContent(body);
    if (!content) throw new Error('Intent router AI response did not include JSON content');
    return JSON.parse(content) as unknown;
  };
}
