import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { inspectIsolation, searchWithGrok } from '../src/grokCli.js';

const runIntegration = process.env.RUN_GROK_INTEGRATION === '1';

describe.skipIf(!runIntegration)('Grok CLI integration', () => {
  it(
    'keeps the isolated profile free of user hooks, skills, and MCP servers',
    async () => {
      const isolation = await inspectIsolation(loadConfig());

      expect(isolation).toEqual({ hooks: 0, skills: 0, mcpServers: 0 });
    },
    240_000,
  );

  it(
    'searches the web through Grok CLI',
    async () => {
      const result = await searchWithGrok(
        'web',
        { query: 'xAI Grok Build Headless & Scripting', domains: ['docs.x.ai'], maxResults: 3 },
        loadConfig(),
      );

      expect(result.urls.some((url) => url.includes('docs.x.ai/build/cli/headless-scripting'))).toBe(true);
    },
    240_000,
  );

  it(
    'searches X through Grok CLI runtime tools',
    async () => {
      const result = await searchWithGrok('x', { query: '@grok Grok CLI', handles: ['@grok'], maxResults: 3 }, loadConfig());

      expect(result.urls.some((url) => /^https:\/\/x\.com\/.+\/status\/\d+/.test(url))).toBe(true);
    },
    240_000,
  );
});
