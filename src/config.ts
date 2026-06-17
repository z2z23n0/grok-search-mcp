import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_MODEL = 'grok-build';
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_TURNS = 6;
const DEFAULT_BIN = 'grok';

export type RuntimeConfig = {
  grokBin: string;
  profileHome: string;
  model: string;
  timeoutMs: number;
  maxTurns: number;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const expandHome = (value: string): string => {
  if (value === '~') {
    return homedir();
  }
  if (value.startsWith('~/')) {
    return join(homedir(), value.slice(2));
  }
  return value;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): RuntimeConfig => {
  const profileHome = env.GROK_SEARCH_MCP_HOME?.trim() || join(homedir(), '.grok-search-mcp');
  return {
    grokBin: env.GROK_BIN?.trim() || DEFAULT_BIN,
    profileHome: resolve(expandHome(profileHome)),
    model: env.GROK_SEARCH_MCP_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs: parsePositiveInt(env.GROK_SEARCH_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxTurns: parsePositiveInt(env.GROK_SEARCH_MCP_MAX_TURNS, DEFAULT_MAX_TURNS),
  };
};
