#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { checkAuthenticated, inspectIsolation, runLogin } from './grokCli.js';
import { createServer } from './server.js';

const printDoctor = async (): Promise<number> => {
  const config = loadConfig();
  const isolation = await inspectIsolation(config);
  const authenticated = await checkAuthenticated(config);
  const ok = authenticated && isolation.hooks === 0 && isolation.skills === 0 && isolation.mcpServers === 0;
  const result = {
    ok,
    grokBin: config.grokBin,
    profileHome: config.profileHome,
    model: config.model,
    authenticated,
    isolation,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return ok ? 0 : 1;
};

const main = async (): Promise<number> => {
  const [command, ...args] = process.argv.slice(2);
  const config = loadConfig();

  if (command === 'login') {
    return await runLogin(config, args);
  }

  if (command === 'doctor') {
    return await printDoctor();
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(
      [
        'Usage:',
        '  grok-search-mcp              Start MCP stdio server',
        '  grok-search-mcp login        Login isolated Grok CLI profile',
        '  grok-search-mcp doctor       Check auth and isolation',
        '',
        'Environment:',
        '  GROK_BIN                     grok binary path (default: grok)',
        '  GROK_SEARCH_MCP_HOME         isolated profile home (default: ~/.grok-search-mcp)',
        '  GROK_SEARCH_MCP_MODEL        Grok CLI model (default: grok-build)',
        '  GROK_SEARCH_MCP_TIMEOUT_MS   per-call timeout (default: 180000)',
        '',
      ].join('\n'),
    );
    return 0;
  }

  if (command) {
    process.stderr.write(`Unknown command: ${command}\n`);
    return 2;
  }

  const server = createServer(config);
  await server.connect(new StdioServerTransport());
  return 0;
};

main()
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
