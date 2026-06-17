import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RuntimeConfig } from './config.js';
import { buildPrompt } from './prompt.js';
import { extractGrokText, parseSearchText } from './parser.js';
import type { SearchMode, SearchResult, WebSearchArgs, XSearchArgs } from './types.js';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 16 * 1024 * 1024;

export type InspectSummary = {
  hooks: number;
  skills: number;
  mcpServers: number;
};

type ExecError = Error & {
  code?: string | number;
  killed?: boolean;
  signal?: string;
  stdout?: string;
  stderr?: string;
};

export const buildIsolatedEnv = (config: RuntimeConfig, baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => ({
  ...baseEnv,
  HOME: config.profileHome,
  XDG_CONFIG_HOME: join(config.profileHome, '.config'),
  XDG_CACHE_HOME: join(config.profileHome, '.cache'),
  XDG_DATA_HOME: join(config.profileHome, '.local', 'share'),
  NO_COLOR: '1',
});

export const ensureProfileHome = async (config: RuntimeConfig): Promise<void> => {
  await mkdir(join(config.profileHome, '.config'), { recursive: true });
  await mkdir(join(config.profileHome, '.cache'), { recursive: true });
  await mkdir(join(config.profileHome, '.local', 'share'), { recursive: true });
};

export const buildGrokArgs = (prompt: string, config: RuntimeConfig): string[] => [
  '--single',
  prompt,
  '--output-format',
  'json',
  '--no-alt-screen',
  '--no-subagents',
  '--no-memory',
  '--no-plan',
  '--model',
  config.model,
  '--max-turns',
  String(config.maxTurns),
];

export const formatGrokError = (error: unknown, config: RuntimeConfig): Error => {
  const err = error as ExecError;
  if (err.code === 'ENOENT') {
    return new Error(`grok CLI not found at "${config.grokBin}". Set GROK_BIN to the installed grok binary.`);
  }
  if (err.killed || err.signal === 'SIGTERM') {
    return new Error(`grok CLI timed out after ${config.timeoutMs}ms.`);
  }

  const stderr = err.stderr?.trim() ?? '';
  const stdout = err.stdout?.trim() ?? '';
  if (/not authenticated/i.test(stderr) || /not authenticated/i.test(stdout)) {
    return new Error(
      `isolated Grok profile is not authenticated. Run: GROK_SEARCH_MCP_HOME="${config.profileHome}" ` +
        `GROK_BIN="${config.grokBin}" grok-search-mcp login`,
    );
  }

  return new Error(stderr || err.message || 'grok CLI failed with an unknown error.');
};

const runGrok = async (args: string[], config: RuntimeConfig): Promise<string> => {
  await ensureProfileHome(config);
  const cwd = await mkdtemp(join(tmpdir(), 'grok-search-mcp-'));
  try {
    const { stdout } = await execFileAsync(config.grokBin, args, {
      cwd,
      env: buildIsolatedEnv(config),
      timeout: config.timeoutMs,
      maxBuffer: MAX_BUFFER,
    });
    return stdout;
  } catch (error) {
    const err = error as ExecError;
    if (err.stdout?.trim()) {
      return err.stdout;
    }
    throw formatGrokError(error, config);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
};

export const searchWithGrok = async (
  mode: SearchMode,
  args: XSearchArgs | WebSearchArgs,
  config: RuntimeConfig,
): Promise<SearchResult> => {
  const prompt = buildPrompt(mode, args);
  const stdout = await runGrok(buildGrokArgs(prompt, config), config);
  const text = extractGrokText(stdout);
  return parseSearchText(text, mode, config);
};

export const runLogin = async (config: RuntimeConfig, extraArgs: string[] = []): Promise<number> => {
  await ensureProfileHome(config);
  const cwd = await mkdtemp(join(tmpdir(), 'grok-search-mcp-login-'));
  return await new Promise((resolve) => {
    const child = spawn(config.grokBin, ['login', ...extraArgs], {
      cwd,
      env: buildIsolatedEnv(config),
      stdio: 'inherit',
    });
    child.on('close', async (code) => {
      await rm(cwd, { recursive: true, force: true });
      resolve(code ?? 1);
    });
    child.on('error', async () => {
      await rm(cwd, { recursive: true, force: true });
      resolve(1);
    });
  });
};

export const inspectIsolation = async (config: RuntimeConfig): Promise<InspectSummary> => {
  const stdout = await runGrok(['inspect', '--json'], config);
  const parsed = JSON.parse(stdout) as {
    hooks?: unknown[];
    skills?: unknown[];
    mcpServers?: unknown[];
  };
  return {
    hooks: parsed.hooks?.length ?? 0,
    skills: parsed.skills?.length ?? 0,
    mcpServers: parsed.mcpServers?.length ?? 0,
  };
};

export const checkAuthenticated = async (config: RuntimeConfig): Promise<boolean> => {
  const stdout = await runGrok(['models'], config);
  return !/not authenticated/i.test(stdout);
};
