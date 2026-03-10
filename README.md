# YouTube Video Podcast Agent

A LangGraph agent that researches YouTube videos on a given topic and saves them to disk for podcast curation. Powered by [Ollama](https://ollama.com) (local LLM) and [LangGraph](https://langchain-ai.github.io/langgraphjs/).

## Overview

The system consists of two graphs:

- **`youtubeVideoAgent`** — A ReAct-style agent that takes a natural language prompt and calls the research pipeline as a tool.
- **`researchGraph`** — A sequential 9-step pipeline that resolves data sources, searches YouTube, filters results, and writes them to disk.

```
User prompt
    │
    ▼
youtubeVideoAgent (LLM + tools)
    │
    └──► researchGraph (9-step pipeline)
              │
              ├── 01 Capture env state
              ├── 02 Resolve data source
              ├── 03 Build search query
              ├── 04 Fetch videos
              ├── 05 Filter by date
              ├── 06 Detect language
              ├── 07 Map to video interface
              ├── 08 Save results
              └── 09 Write run manifest
```

## Data Sources

The pipeline selects a data source automatically based on which credentials are present:

| Priority | Source | Credential required |
|----------|--------|-------------------|
| 1 | YouTube Data API v3 | `YOUTUBE_API_KEY` |
| 2 | Tavily Search API | `TAVILY_API_KEY` |
| 3 | Webscrape (YouTube HTML) | *(none — proxy optional)* |

## Requirements

- [Bun](https://bun.sh) v1.x
- [Ollama](https://ollama.com) running `deepseek-r1:70b` (or update the model in `src/models/index.mts`)

## Setup

```bash
bun install
```

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

**.env variables:**

```env
# At least one of the following API keys is recommended
YOUTUBE_API_KEY=
TAVILY_API_KEY=

# Optional — Decodo proxy credentials for the webscrape fallback
WEB_SCRAPING_USERNAME=
WEB_SCRAPING_PASSWORD=

# Ollama server URL (defaults to localhost)
OLLAMA_SERVER_URL=http://localhost:11434

# Optional — tune search behaviour (defaults shown)
MAX_RESULTS=50
LOOKBACK_DAYS=7
LANGUAGE=en
INCLUDE_SHORTS=true
```

## Usage

### LangGraph Studio (recommended)

```bash
bunx @langchain/langgraph-cli dev
```

Open [LangGraph Studio](https://smith.langchain.com/studio?baseUrl=http://localhost:2024), select a graph from the dropdown, and send a prompt such as:

> I want to see videos on Claude Code and the Aral Balkan loop for the last 3 days

### Programmatic

```typescript
import { youtubeVideoAgent } from "./src/agents/index.mts";

const result = await youtubeVideoAgent.invoke({
  messages: [{ role: "user", content: "Find recent videos about LangGraph tutorials" }],
});
```

## Output

Results are written to `docs/youtube/topic/`:

```
docs/youtube/topic/
└── {topic-slug}/
    ├── {query-slug}.json    # deduplicated video list
    └── manifest.json        # append-only run log
```

**`{query-slug}.json`** — array of mapped videos:
```json
{
  "topicName": "claude-code",
  "queryName": "general",
  "videos": [
    {
      "Title": "Claude Code deep dive",
      "Url": "https://www.youtube.com/watch?v=...",
      "PublishedAt": "2026-03-07T...",
      "DefaultLanguage": "en",
      "IsShort": 0
    }
  ]
}
```

**`manifest.json`** — one entry per run, tracking counts, excluded videos, and errors.

## Project Structure

```
src/
├── agents/         # youtubeVideoAgent (LLM + tool node)
├── graphs/         # researchGraph (9-step StateGraph)
├── nodes/          # one file per pipeline step
├── models/         # Ollama model configuration
├── schemas/        # Zod schemas for each step output
├── tools/          # LangGraph tools (readFile, writeFile, readEnv)
├── types/          # TypeScript types inferred from schemas
└── workflows/      # Markdown spec files for each research step
```

## Tech Stack

| Package | Purpose |
|---------|---------|
| `@langchain/langgraph` | Graph orchestration |
| `@langchain/ollama` | Local LLM via Ollama |
| `@langchain/tavily` | Tavily search integration |
| `zod` | Runtime schema validation |
| `bun` | Runtime, file I/O |
