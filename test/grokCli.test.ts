import { describe, expect, it } from 'vitest';
import type { RuntimeConfig } from '../src/config.js';
import { buildGrokArgs, buildIsolatedEnv, formatGrokError } from '../src/grokCli.js';

const config: RuntimeConfig = {
  grokBin: '/opt/grok/bin/grok',
  profileHome: '/tmp/isolated-grok-home',
  model: 'grok-build',
  timeoutMs: 180_000,
  maxTurns: 6,
};

describe('grok CLI adapter', () => {
  it('builds isolated environment values', () => {
    const env = buildIsolatedEnv(config, { HOME: '/Users/example', PATH: '/bin' });

    expect(env.HOME).toBe('/tmp/isolated-grok-home');
    expect(env.XDG_CONFIG_HOME).toBe('/tmp/isolated-grok-home/.config');
    expect(env.XDG_CACHE_HOME).toBe('/tmp/isolated-grok-home/.cache');
    expect(env.XDG_DATA_HOME).toBe('/tmp/isolated-grok-home/.local/share');
    expect(env.PATH).toBe('/bin');
  });

  it('builds expected Grok single-turn args', () => {
    const args = buildGrokArgs('search prompt', config);

    expect(args).toContain('--single');
    expect(args).toContain('search prompt');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--no-subagents');
    expect(args).toContain('--no-memory');
    expect(args).toContain('--no-plan');
    expect(args).toContain('--model');
    expect(args).toContain('grok-build');
  });

  it('maps missing binary errors', () => {
    const error = Object.assign(new Error('spawn failed'), { code: 'ENOENT' });

    expect(formatGrokError(error, config).message).toContain('grok CLI not found');
  });

  it('maps unauthenticated output', () => {
    const error = Object.assign(new Error('failed'), { stdout: 'You are not authenticated.' });

    expect(formatGrokError(error, config).message).toContain('isolated Grok profile is not authenticated');
  });
});
