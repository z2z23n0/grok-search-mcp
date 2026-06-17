import { describe, expect, it } from 'vitest';
import { TOOL_NAMES } from '../src/server.js';

describe('MCP server contract', () => {
  it('exposes only search tools', () => {
    expect(TOOL_NAMES).toEqual(['grok_x_search', 'grok_web_search']);
  });
});
