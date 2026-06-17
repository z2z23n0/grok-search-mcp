import { describe, expect, it } from 'vitest';
import { extractGrokText, parseSearchText } from '../src/parser.js';
import type { RuntimeConfig } from '../src/config.js';

const config: RuntimeConfig = {
  grokBin: 'grok',
  profileHome: '/tmp/grok-search-mcp-test-home',
  model: 'grok-build',
  timeoutMs: 180_000,
  maxTurns: 6,
};

describe('parser', () => {
  it('extracts text from the Grok JSON envelope', () => {
    expect(extractGrokText(JSON.stringify({ text: 'hello' }))).toBe('hello');
  });

  it('parses a valid structured JSON answer', () => {
    const result = parseSearchText(
      JSON.stringify({
        summary: 'found docs',
        items: [{ title: 'Docs', url: 'https://docs.x.ai/build/cli/headless-scripting' }],
        urls: ['https://docs.x.ai/build/cli/headless-scripting'],
      }),
      'web',
      config,
    );

    expect(result.diagnostics.parseOk).toBe(true);
    expect(result.diagnostics.structured).toBe(true);
    expect(result.summary).toBe('found docs');
    expect(result.items).toHaveLength(1);
    expect(result.urls).toContain('https://docs.x.ai/build/cli/headless-scripting');
  });

  it('parses JSON inside a markdown fence', () => {
    const result = parseSearchText(
      '```json\n{"summary":"ok","items":[],"urls":["https://x.com/grok/status/1"]}\n```',
      'x',
      config,
    );

    expect(result.diagnostics.parseOk).toBe(true);
    expect(result.diagnostics.structured).toBe(true);
    expect(result.urls).toContain('https://x.com/grok/status/1');
  });

  it('falls back to raw text and synthesizes URL items', () => {
    const result = parseSearchText('See https://x.com/grok/status/123 for details.', 'x', config);

    expect(result.diagnostics.parseOk).toBe(false);
    expect(result.diagnostics.structured).toBe(false);
    expect(result.rawText).toContain('https://x.com/grok/status/123');
    expect(result.urls).toEqual(['https://x.com/grok/status/123']);
    expect(result.items).toEqual([
      {
        title: 'x.com',
        url: 'https://x.com/grok/status/123',
        source: 'x.com',
        snippet: 'See https://x.com/grok/status/123 for details.',
      },
    ]);
  });

  it('synthesizes URL items when structured JSON only declares urls', () => {
    const result = parseSearchText(
      JSON.stringify({
        summary: 'found URLs',
        items: [],
        urls: ['https://github.com/modelcontextprotocol/servers'],
      }),
      'web',
      config,
    );

    expect(result.diagnostics.parseOk).toBe(true);
    expect(result.diagnostics.structured).toBe(true);
    expect(result.items).toEqual([
      {
        title: 'github.com',
        url: 'https://github.com/modelcontextprotocol/servers',
        source: 'github.com',
        snippet: 'found URLs',
      },
    ]);
  });
});
