# Ollama Agents

A collection of LangGraph agents powered by locally-hosted LLMs via [Ollama](https://ollama.com).

Each agent lives in its own directory with its own dependencies and README.

## Agents

### [youtube-video-podcast-agent](./youtube-video-podcast-agent)

Researches YouTube videos on a given topic and saves them to disk for podcast curation.

Send a natural language prompt such as _"Find recent videos about Claude Code from the last 3 days"_ and the agent runs a 9-step research pipeline that fetches, filters, and persists results automatically.

**Data sources:** YouTube Data API v3 → Tavily Search → YouTube webscrape (fallback)
**Runtime:** Bun · **LLM:** Ollama (`deepseek-r1:70b`) · **Framework:** LangGraph

---

*More agents coming soon.*
