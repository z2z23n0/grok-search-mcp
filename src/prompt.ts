import type { SearchMode, WebSearchArgs, XSearchArgs } from './types.js';

const jsonContract = `
Return only a JSON object with this exact shape:
{
  "summary": "one concise paragraph",
  "items": [
    {
      "title": "short title or post description",
      "url": "canonical URL",
      "author": "author display name when available",
      "handle": "@handle when available",
      "publishedAt": "ISO date or human date when available",
      "snippet": "short relevant excerpt or summary",
      "source": "X or website name"
    }
  ],
  "urls": ["all important source URLs"]
}
Do not include markdown fences, commentary, or fields outside this JSON object.
`;

const maxResultsLine = (maxResults: number | undefined): string =>
  `Return up to ${Math.min(Math.max(maxResults ?? 8, 1), 20)} high-signal results.`;

export const buildXSearchPrompt = (args: XSearchArgs): string => {
  const filters = [
    args.handles?.length ? `Restrict or prioritize these X handles: ${args.handles.join(', ')}.` : '',
    args.since ? `Prefer posts after: ${args.since}.` : '',
    args.until ? `Prefer posts before: ${args.until}.` : '',
  ].filter(Boolean);

  return [
    'Use Grok CLI runtime X/Twitter search tools, especially X keyword search or X semantic search.',
    'Do not answer from ordinary web search unless X search is unavailable; if unavailable, say so in the summary.',
    `Search X/Twitter for: ${args.query}`,
    ...filters,
    maxResultsLine(args.maxResults),
    'Prefer direct x.com status URLs. Do not invent URLs.',
    jsonContract,
  ].join('\n');
};

export const buildWebSearchPrompt = (args: WebSearchArgs): string => {
  const filters = [
    args.domains?.length ? `Restrict or strongly prioritize these domains: ${args.domains.join(', ')}.` : '',
    args.excludedDomains?.length ? `Exclude these domains: ${args.excludedDomains.join(', ')}.` : '',
    args.recency ? `Recency requirement: ${args.recency}.` : '',
  ].filter(Boolean);

  return [
    'Use Grok CLI runtime web search and web fetch tools.',
    `Search the web for: ${args.query}`,
    ...filters,
    maxResultsLine(args.maxResults),
    'Prefer primary sources and stable canonical URLs. Do not invent URLs.',
    jsonContract,
  ].join('\n');
};

export const buildPrompt = (mode: SearchMode, args: XSearchArgs | WebSearchArgs): string =>
  mode === 'x' ? buildXSearchPrompt(args as XSearchArgs) : buildWebSearchPrompt(args as WebSearchArgs);
