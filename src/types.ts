export type SearchMode = 'x' | 'web';

export type SearchItem = {
  title?: string;
  url?: string;
  author?: string;
  handle?: string;
  publishedAt?: string;
  snippet?: string;
  source?: string;
};

export type SearchDiagnostics = {
  mode: SearchMode;
  parseOk: boolean;
  structured: boolean;
  model: string;
  isolatedHome: string;
  warnings: string[];
};

export type SearchResult = {
  summary: string;
  items: SearchItem[];
  urls: string[];
  rawText: string;
  diagnostics: SearchDiagnostics;
};

export type XSearchArgs = {
  query: string;
  handles?: string[];
  since?: string;
  until?: string;
  maxResults?: number;
};

export type WebSearchArgs = {
  query: string;
  domains?: string[];
  excludedDomains?: string[];
  recency?: string;
  maxResults?: number;
};
