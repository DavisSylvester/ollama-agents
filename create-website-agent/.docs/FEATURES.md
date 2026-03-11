# Features

## 7-Step Pipeline

Each step is a LangChain tool. `qwen3` calls them in order via the ralph loop.

| Step | Tool | File | Description |
|---|---|---|---|
| 1 | `collect_business_info` | `src/tools/collect-business-info.mts` | Interview the user via WebSocket Q&A |
| 2 | `research_competitors` | `src/tools/research-competitors.mts` | DuckDuckGo + Tavily search, cheerio scraping |
| 3 | `generate_copy` | `src/tools/generate-copy.mts` | AI copywriting (hero, about, services, contact) |
| 4 | `generate_design` | `src/tools/generate-design.mts` | Color palette, fonts, layout style |
| 5 | `generate_images` | `src/tools/generate-images.mts` | Nano Banana AI images or Picsum fallback |
| 6 | `generate_html` | `src/tools/generate-html.mts` | Full HTML/Tailwind page, streamed to browser |
| 7 | `write_output` | `src/tools/write-output.mts` | Save to `generated-websites/<slug>/` |

---

## Web Search (Step 2)

Both search engines run in **parallel**, results are deduplicated by normalised URL:

```
DuckDuckGo HTML scraping  ──┐
                             ├─► dedup by URL ──► cheerio scrape sample URLs
Tavily (if key set)       ──┘
```

- DuckDuckGo: scrapes `https://html.duckduckgo.com/html/?q=...`
- Tavily: `TavilySearch({ tavilyApiKey })` — invoke: `{ query: "..." }`
- Dedup key: URL with `https?://(www.)?` stripped
- Results printed to console with source tags
- Up to 4 sample/competitor URLs scraped for colors, fonts, sections

---

## Image Generation (Step 5)

| Condition | Engine | Output |
|---|---|---|
| `GEMINI_API_KEY` set | `nano-banana-pro-preview` via `@google/genai` | PNG files in `generated-websites/<slug>/images/` |
| No key | Picsum Photos | Seeded placeholder URLs (deterministic per slug) |

Images generated per section:
- `hero` — 1920×1080
- `about` — 800×600
- `service_0..N` — 400×300 each

If Nano Banana fails for a specific image (quota, network), Picsum is used as a **per-image fallback**.

UI logs:
- `Image engine: nano-banana-pro-preview` (or Picsum)
- `[nano-banana-pro-preview] generating hero…`
- `✓ hero — saved via nano-banana-pro-preview` (or `✗ … using Picsum fallback`)

**Note:** `nano-banana-pro-preview` requires a paid Google AI plan. The free tier returns 429.

---

## HTML Generation (Step 6)

Uses `chattingModel` (temperature 0.7) with streaming. Chunks are forwarded to the browser
in real-time via `agentIO.stream(chunk)`. The LLM generates a complete Tailwind CDN page with:

- Sticky nav, hero with CTA, about section, services grid, contact form, footer
- Colors from `DesignBrief`, copy from `PageCopy`, images from `generate_images`
- Mobile-first, responsive

---

## Output Folder — No Overwrite

`write-output` finds the first available folder name before saving:

```
generated-websites/acme-corp/        ← first build
generated-websites/acme-corp-2/      ← second fresh build for same company
generated-websites/acme-corp-rev-1/  ← revision 1
generated-websites/acme-corp-rev-2/  ← revision 2
```

---

## Revision System

After a successful build, the user can request up to **5 revisions** of the same site.
Revisions skip the interview and research steps — they reuse the collected data and regenerate
copy, design, images, and HTML with a prompt instructing the model to use **different colors
and layout**.

### Flow

```
Build completes
  → server stores { businessContextJson, researchNotesJson, baseSlug, count: 0 }
  → browser receives revision_available { count: 0, max: 5 }
  → "Revise (5 left)" button shown

User clicks Revise
  → browser sends { type: "revise" }
  → server increments count, computes revisionSlug = `${baseSlug}-rev-${count}`
  → runRevision(businessContextJson, researchNotesJson, revisionSlug) called
  → steps 3–7 run with REVISION_PROMPT
  → new site saved to generated-websites/<slug>-rev-N/
  → revision_available { count: N, max: 5 } sent
  → button updates to "Revise (N left)"

After 5 revisions
  → revise_limit sent → button hidden, message shown
```

### Revision prompt

```
You are an AI Website Builder in REVISION MODE. Business data is already collected.
Use the businessContextJson and researchNotes provided in the user message.
Generate a CREATIVE, visually DIFFERENT version — vary the color palette, layout style, and copy tone.
Use slug="<revisionSlug>" for generate_images and write_output.
Call tools 3–7 IN ORDER. Do not call collect_business_info or research_competitors.
```

---

## Context Monitor

After every `agentNode` invocation, token usage is checked against the model's `num_ctx`:

1. `warmContextSize()` — queries `OLLAMA_HOST/api/show` for `num_ctx` at startup (cached)
2. `checkContext(response, messages, log)` — reads `prompt_eval_count` from response metadata
3. Logs `Context: X.X% (N / M tokens)` to the UI on every agent decision
4. At **≥ 60%** — writes a checkpoint JSON to `generated-websites/checkpoints/checkpoint-<ts>.json`
   containing all tool outputs collected so far

**File:** [`src/utils/context-monitor.mts`](../src/utils/context-monitor.mts)

---

## Thinking Indicator

While `qwen3` is processing (between tool calls), the browser shows a rotating word bubble:

> *Pondering…* → *Reasoning…* → *Deliberating…* → *Computing…* → …

15 words rotate every 2 seconds. The bubble disappears when the model returns a response.

Implemented via `agentIO.thinking()` / `agentIO.thinkingEnd()` wrapping `model.invoke()` in `agentNode`.

---

## Typed Environment

All env var reads go through [`src/env.mts`](../src/env.mts) — never `process.env` directly.

```typescript
export const env = {
  OLLAMA_HOST: optionalEnv('OLLAMA_HOST', 'http://192.168.128.230:11434'),
  OLLAMA_MODEL: optionalEnv('OLLAMA_MODEL', 'qwen3'),
  GEMINI_API_KEY: optionalEnv('GEMINI_API_KEY'),
  TAVILY_API_KEY: optionalEnv('TAVILY_API_KEY'),
  PORT: parseInt(optionalEnv('PORT', '3000'), 10),
} as const;
```
