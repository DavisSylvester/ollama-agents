# AI Website Builder — create-website-agent

An agentic AI landing page builder powered by **Ollama + LangGraph** (ralph loop pattern).
Interviews the user, researches competitors, writes copy, designs the layout, generates images,
produces a complete HTML/Tailwind site, and saves it to disk — all autonomously.

## Quick Start

```bash
# Install dependencies
bun install

# Copy env template and fill in values
cp .env.example .env

# Start web UI (browser at http://localhost:3000)
bun start

# Or launch as Electron desktop app
bun run electron
```

## Required Environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `OLLAMA_HOST` | No | `http://192.168.128.230:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `qwen3` | LLM model name |
| `PORT` | No | `3000` | Express server port |
| `TAVILY_API_KEY` | No | — | Enables Tavily web search (falls back to DuckDuckGo) |
| `GEMINI_API_KEY` | No | — | Enables Nano Banana AI image generation (falls back to Picsum) |

## Output

Generated sites are saved to:
```
generated-websites/
└── <company-slug>/
    ├── index.html
    └── images/          ← AI-generated PNGs (requires GEMINI_API_KEY)
```

If `<company-slug>` already exists, the folder is named `<slug>-2`, `<slug>-3`, etc.
Revisions are saved as `<slug>-rev-1`, `<slug>-rev-2`, up to 5 revisions.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical breakdown.

## Features

See [FEATURES.md](./FEATURES.md) for all features and implementation notes.
