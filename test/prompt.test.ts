import { describe, expect, it } from 'vitest';
import { buildWebSearchPrompt, buildXSearchPrompt } from '../src/prompt.js';

describe('prompt builders', () => {
  it('builds an X search prompt that asks for X-specific search', () => {
    const prompt = buildXSearchPrompt({
      query: '@grok Grok CLI',
      handles: ['@grok'],
      since: '2026-06-01',
      maxResults: 5,
    });

    expect(prompt).toContain('X/Twitter search tools');
    expect(prompt).toContain('X keyword search');
    expect(prompt).toContain('@grok Grok CLI');
    expect(prompt).toContain('direct x.com status URLs');
    expect(prompt).toContain('"items"');
  });

  it('builds a web search prompt that asks for web search and domain filters', () => {
    const prompt = buildWebSearchPrompt({
      query: 'xAI Grok Build headless scripting',
      domains: ['docs.x.ai'],
      excludedDomains: ['example.com'],
      maxResults: 3,
    });

    expect(prompt).toContain('Search the web for: xAI Grok Build headless scripting');
    expect(prompt).not.toContain('Use Grok CLI runtime web search');
    expect(prompt).not.toContain('Return only');
    expect(prompt).toContain('docs.x.ai');
    expect(prompt).toContain('example.com');
    expect(prompt).toContain('primary sources');
    expect(prompt).toContain('"urls"');
  });
});
