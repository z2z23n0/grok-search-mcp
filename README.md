# grok-search-mcp

MCP server that brings Grok CLI web and X/Twitter search to Codex and Claude
Code.

This project exists to give Codex and Claude Code a better search lane when
their built-in search experience is not enough. Grok's search, especially for
X/Twitter content, is often noticeably better than what these coding agents can
reach on their own. `grok-search-mcp` exposes that advantage through a small,
isolated MCP server, so agents can ask Grok for web or X search results without
turning Grok into a general chat dependency.

This project is intentionally narrow:

- no xAI API key
- no API credits
- no image or video tools
- no generic Grok chat tool
- only web search and X/Twitter search through `grok`

The server runs `grok` with an isolated `HOME`, so it does not load your normal
Cursor/Claude/Grok user-level MCP servers, hooks, or skills.

## Tools

| Tool | Purpose |
| --- | --- |
| `grok_x_search` | Search X/Twitter through Grok CLI runtime search tools |
| `grok_web_search` | Search the web through Grok CLI runtime web search |

Both tools return a JSON string with this shape:

```json
{
  "summary": "short summary",
  "items": [],
  "urls": [],
  "rawText": "raw Grok answer",
  "diagnostics": {
    "mode": "x",
    "parseOk": true,
    "model": "grok-build",
    "isolatedHome": "/Users/me/.grok-search-mcp",
    "warnings": []
  }
}
```

If Grok does not return parseable JSON, the server keeps the raw answer and sets
`diagnostics.parseOk=false`.

## Requirements

- Node.js 20+
- The official Grok CLI installed
- A Grok CLI account/subscription that can use search

Install Grok CLI if needed:

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

## One-time login

The MCP server uses a dedicated profile home, defaulting to
`~/.grok-search-mcp`. Log in once for that isolated profile:

```bash
GROK_BIN="/Users/zhangyuze/.grok/bin/grok" \
GROK_SEARCH_MCP_HOME="$HOME/.grok-search-mcp" \
npx -y github:z2z23n0/grok-search-mcp login
```

You do not need to log in for every search. Run this again only if the isolated
profile token expires or is revoked.

Check the setup:

```bash
GROK_BIN="/Users/zhangyuze/.grok/bin/grok" \
GROK_SEARCH_MCP_HOME="$HOME/.grok-search-mcp" \
npx -y github:z2z23n0/grok-search-mcp doctor
```

`doctor` should report:

```json
{
  "ok": true,
  "authenticated": true,
  "isolation": {
    "hooks": 0,
    "skills": 0,
    "mcpServers": 0
  }
}
```

## Client setup

### Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.grok_search]
command = "npx"
args = ["-y", "github:z2z23n0/grok-search-mcp"]
enabled_tools = ["grok_x_search", "grok_web_search"]
default_tools_approval_mode = "auto"
startup_timeout_sec = 120
tool_timeout_sec = 240

[mcp_servers.grok_search.env]
GROK_BIN = "/Users/zhangyuze/.grok/bin/grok"
GROK_SEARCH_MCP_HOME = "/Users/zhangyuze/.grok-search-mcp"
GROK_SEARCH_MCP_MODEL = "grok-build"
NPM_CONFIG_REGISTRY = "https://registry.npmjs.org"
```

Restart Codex after editing MCP config.

### Claude Code

Add the MCP server with Claude Code's CLI:

```bash
claude mcp add --scope user --transport stdio grok-search \
  --env GROK_BIN=/Users/zhangyuze/.grok/bin/grok \
  --env GROK_SEARCH_MCP_HOME=$HOME/.grok-search-mcp \
  --env GROK_SEARCH_MCP_MODEL=grok-build \
  --env NPM_CONFIG_REGISTRY=https://registry.npmjs.org \
  -- npx -y github:z2z23n0/grok-search-mcp
```

Check the registration:

```bash
claude mcp list
```

Example prompts:

```text
Use grok_search.grok_x_search to search X for recent @grok posts about Grok CLI.
```

```text
Use grok_search.grok_web_search to search docs.x.ai for Grok Build headless scripting.
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `GROK_BIN` | `grok` | Path to the Grok CLI binary |
| `GROK_SEARCH_MCP_HOME` | `~/.grok-search-mcp` | Isolated profile home |
| `GROK_SEARCH_MCP_MODEL` | `grok-build` | Grok CLI model |
| `GROK_SEARCH_MCP_TIMEOUT_MS` | `180000` | Per-call timeout |
| `GROK_SEARCH_MCP_MAX_TURNS` | `6` | Max Grok turns per search |

The server sets these for the Grok subprocess:

- `HOME=$GROK_SEARCH_MCP_HOME`
- `XDG_CONFIG_HOME=$GROK_SEARCH_MCP_HOME/.config`
- `XDG_CACHE_HOME=$GROK_SEARCH_MCP_HOME/.cache`
- `XDG_DATA_HOME=$GROK_SEARCH_MCP_HOME/.local/share`

It also runs Grok from a temporary empty working directory instead of your repo.

## Local development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Integration tests are skipped by default because they require a logged-in
isolated Grok profile:

```bash
RUN_GROK_INTEGRATION=1 npm run test:integration
```

## Notes

`grok_x_search` relies on Grok CLI agent runtime behavior. It does not call the
public xAI API `x_search` tool, so it avoids API billing but cannot promise API
level filtering or schemas.
