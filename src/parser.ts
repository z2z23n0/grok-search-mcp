import type { RuntimeConfig } from './config.js';
import type { SearchItem, SearchMode, SearchResult } from './types.js';

type GrokEnvelope = {
  text?: unknown;
};

const urlPattern = /https?:\/\/[^\s<>"')\]]+/g;
const MAX_SUMMARY_LENGTH = 1000;

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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sourceFromUrl = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const titleFromMarkdownLink = (text: string, url: string): string | undefined => {
  const match = text.match(new RegExp(`\\[([^\\]]{1,120})\\]\\(${escapeRegExp(url)}\\)`));
  return match?.[1]?.trim() || undefined;
};

const snippetForUrl = (text: string, url: string): string | undefined => {
  const line = text.split(/\r?\n/).find((candidate) => candidate.includes(url));
  return line?.replace(/\s+/g, ' ').replace(/^[-*]\s*/, '').trim().slice(0, 300) || undefined;
};

const synthesizeItemsFromUrls = (urls: string[], rawText: string, fallbackSnippet?: string): SearchItem[] =>
  urls.map((url) => {
    const source = sourceFromUrl(url);
    const title = titleFromMarkdownLink(rawText, url) ?? source;
    const snippet = fallbackSnippet?.trim().slice(0, 300) || snippetForUrl(rawText, url);
    return {
      ...(title && { title }),
      url,
      ...(source && { source }),
      ...(snippet && { snippet }),
    };
  });

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

const fallbackResult = (
  rawText: string,
  mode: SearchMode,
  config: RuntimeConfig,
  urls: string[],
  warnings: string[],
): SearchResult => ({
  summary: rawText.trim().slice(0, MAX_SUMMARY_LENGTH),
  items: synthesizeItemsFromUrls(urls, rawText),
  urls,
  rawText,
  diagnostics: {
    mode,
    parseOk: false,
    structured: false,
    model: config.model,
    isolatedHome: config.profileHome,
    warnings,
  },
});

export const parseSearchText = (rawText: string, mode: SearchMode, config: RuntimeConfig): SearchResult => {
  const warnings: string[] = [];
  const urlsFromText = extractUrls(rawText);
  const jsonObject = firstJsonObject(rawText);

  if (!jsonObject) {
    warnings.push('Grok did not return a parseable JSON object; using raw text fallback.');
    return fallbackResult(rawText, mode, config, urlsFromText, warnings);
  }

  try {
    const parsed = JSON.parse(jsonObject) as Record<string, unknown>;
    const items = normalizeItems(parsed.items);
    const declaredUrls = Array.isArray(parsed.urls)
      ? parsed.urls.filter((url): url is string => typeof url === 'string')
      : [];
    const urls = Array.from(new Set([...declaredUrls, ...items.flatMap((item) => (item.url ? [item.url] : [])), ...urlsFromText]));
    const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
    return {
      summary,
      items: items.length ? items : synthesizeItemsFromUrls(urls, rawText, summary),
      urls,
      rawText,
      diagnostics: {
        mode,
        parseOk: true,
        structured: true,
        model: config.model,
        isolatedHome: config.profileHome,
        warnings,
      },
    };
  } catch {
    warnings.push('Grok returned JSON-looking text that failed JSON.parse; using raw text fallback.');
    return fallbackResult(rawText, mode, config, urlsFromText, warnings);
  }
};
