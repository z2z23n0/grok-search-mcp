import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuntimeConfig } from './config.js';
import { searchWithGrok } from './grokCli.js';

export const TOOL_NAMES = ['grok_x_search', 'grok_web_search'] as const;

const xSearchShape = {
  query: z.string().min(1).describe('X/Twitter search query.'),
  handles: z.array(z.string().min(1)).optional().describe('Optional X handles to prioritize, e.g. @grok.'),
  since: z.string().optional().describe('Optional lower date bound or recency hint.'),
  until: z.string().optional().describe('Optional upper date bound.'),
  maxResults: z.number().int().min(1).max(20).optional().describe('Maximum high-signal results to return.'),
};

const webSearchShape = {
  query: z.string().min(1).describe('Web search query.'),
  domains: z.array(z.string().min(1)).optional().describe('Optional domains to prioritize or restrict to.'),
  excludedDomains: z.array(z.string().min(1)).optional().describe('Optional domains to exclude.'),
  recency: z.string().optional().describe('Optional recency requirement.'),
  maxResults: z.number().int().min(1).max(20).optional().describe('Maximum high-signal results to return.'),
};

const xSearchSchema = z.object(xSearchShape);
const webSearchSchema = z.object(webSearchShape);

const textResult = (value: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(value, null, 2),
    },
  ],
});

const errorResult = (message: string) => ({
  content: [
    {
      type: 'text' as const,
      text: message,
    },
  ],
  isError: true,
});

export const createServer = (config: RuntimeConfig): McpServer => {
  const server = new McpServer({ name: 'grok-search-mcp', version: '0.1.0' });

  server.registerTool(
    'grok_x_search',
    {
      title: 'Search X with Grok CLI',
      description:
        'Search X/Twitter through an isolated Grok CLI profile. Does not use xAI API credits.',
      inputSchema: xSearchShape,
    },
    async (args) => {
      try {
        const parsed = xSearchSchema.safeParse(args);
        if (!parsed.success) {
          return errorResult(parsed.error.message);
        }
        return textResult(await searchWithGrok('x', parsed.data, config));
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    'grok_web_search',
    {
      title: 'Search the web with Grok CLI',
      description: 'Search the web through an isolated Grok CLI profile. Does not use xAI API credits.',
      inputSchema: webSearchShape,
    },
    async (args) => {
      try {
        const parsed = webSearchSchema.safeParse(args);
        if (!parsed.success) {
          return errorResult(parsed.error.message);
        }
        return textResult(await searchWithGrok('web', parsed.data, config));
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    },
  );

  return server;
};
