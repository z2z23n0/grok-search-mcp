import type { RuntimeConfig } from './config.js';
import type { SearchItem, SearchMode, SearchResult } from './types.js';

type GrokEnvelope = {
  text?: unknown;
};

const urlPattern = /https?:\/\/[^\s<>"')\]]+/g;

export const extractGrokText = (stdout: string): string => {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed) as GrokEnvelope;
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }
  } catch {
    // Fall through to object extraction.
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate) as GrokEnvelope;
      if (typeof parsed.text === 'string') {
        return parsed.text;
      }
    } catch {
      // Fall through to raw text.
    }
  }

  return trimmed;
};

export const extractUrls = (text: string): string[] =>
  Array.from(new Set((text.match(urlPattern) ?? []).map((url) => url.replace(/[.,;:]+$/, ''))));

const stripJsonFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
};

const firstJsonObject = (text: string): string | null => {
  const source = stripJsonFence(text);
  if (source.startsWith('{') && source.endsWith('}')) {
    return source;
  }

  const start = source.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
};

const normalizeItems = (value: unknown): SearchItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      ...(typeof item.title === 'string' && { title: item.title }),
      ...(typeof item.url === 'string' && { url: item.url }),
      ...(typeof item.author === 'string' && { author: item.author }),
      ...(typeof item.handle === 'string' && { handle: item.handle }),
      ...(typeof item.publishedAt === 'string' && { publishedAt: item.publishedAt }),
      ...(typeof item.snippet === 'string' && { snippet: item.snippet }),
      ...(typeof item.source === 'string' && { source: item.source }),
    }));
};

export const parseSearchText = (rawText: string, mode: SearchMode, config: RuntimeConfig): SearchResult => {
  const warnings: string[] = [];
  const urlsFromText = extractUrls(rawText);
  const jsonObject = firstJsonObject(rawText);

  if (!jsonObject) {
    warnings.push('Grok did not return a parseable JSON object; using raw text fallback.');
    return {
      summary: rawText.trim().slice(0, 1000),
      items: [],
      urls: urlsFromText,
      rawText,
      diagnostics: {
        mode,
        parseOk: false,
        model: config.model,
        isolatedHome: config.profileHome,
        warnings,
      },
    };
  }

  try {
    const parsed = JSON.parse(jsonObject) as Record<string, unknown>;
    const items = normalizeItems(parsed.items);
    const declaredUrls = Array.isArray(parsed.urls)
      ? parsed.urls.filter((url): url is string => typeof url === 'string')
      : [];
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      items,
      urls: Array.from(new Set([...declaredUrls, ...items.flatMap((item) => (item.url ? [item.url] : [])), ...urlsFromText])),
      rawText,
      diagnostics: {
        mode,
        parseOk: true,
        model: config.model,
        isolatedHome: config.profileHome,
        warnings,
      },
    };
  } catch {
    warnings.push('Grok returned JSON-looking text that failed JSON.parse; using raw text fallback.');
    return {
      summary: rawText.trim().slice(0, 1000),
      items: [],
      urls: urlsFromText,
      rawText,
      diagnostics: {
        mode,
        parseOk: false,
        model: config.model,
        isolatedHome: config.profileHome,
        warnings,
      },
    };
  }
};
