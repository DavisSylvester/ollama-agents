# Architecture

## Overview

The app is a **LangGraph StateGraph** (ralph loop) where `qwen3` autonomously picks and
sequences tool calls. An Express + WebSocket server bridges the browser UI to async tool calls.

```
Browser ──WS──► Express server ──► LangGraph graph
                                        │
                                   agent node (qwen3)
                                        │ tool_calls?
                                   ┌────┴────┐
                                   │  tools  │
                                   └────┬────┘
                                        └─► agent node → … → END
```

## Ralph Loop (LangGraph ReAct pattern)

```
START
  │
  ▼
agent node  ──── qwen3 decides next tool call ────────────────┐
  │                                                            │
  │ last message has tool_calls?                              │
  ├── YES ──► tools node (ToolNode executes the call) ────────┘
  │
  └── NO ──► END
```

State is a single `messages: BaseMessage[]` field using `messagesStateReducer`.
Each tool result becomes a `ToolMessage` that the agent reads before picking the next step.

**Key files:**
- [`src/graph/website-graph.mts`](../src/graph/website-graph.mts) — StateGraph definition, `agentNode`, `routeToTools`, `runWebsiteAgent`, `runRevision`
- [`src/models/index.mts`](../src/models/index.mts) — `ChatOllama` factory (`createModel`, `structuredModel`, `chattingModel`)

## AgentIO Singleton

Tools are async but need to pause and wait for user input via WebSocket. The `AgentIO` class
bridges these worlds.

```
Tool calls agentIO.ask("question")
  → Promise stored internally
  → WebSocket sends { type: "question", ... } to browser
  → Browser renders input, user types answer
  → Browser sends { type: "answer", value: "..." }
  → Server calls agentIO.receiveAnswer(value)
  → Promise resolves → tool continues
```

**Key file:** [`src/server/agent-io.mts`](../src/server/agent-io.mts)

### AgentIO public API

| Method | Direction | Description |
|---|---|---|
| `register(ws)` | server→ | Bind active WebSocket |
| `unregister()` | server→ | Clear WebSocket on disconnect |
| `ask(q, opts?)` | tool→browser | Question with optional choices, returns Promise |
| `askUpload(label)` | tool→browser | File upload prompt, returns Promise |
| `receiveAnswer(v)` | browser→tool | Resolves pending ask() |
| `receiveUpload(f)` | browser→tool | Resolves pending askUpload() |
| `log(msg)` | tool→browser | Status log line |
| `stage(n, label)` | tool→browser | Pipeline step indicator |
| `streamStart/stream/streamEnd` | tool→browser | Streaming text chunks |
| `thinking()/thinkingEnd()` | graph→browser | Model thinking indicator |
| `done(label)` | tool→browser | Step complete badge |
| `complete(slug)` | tool→browser | Build finished, show preview |
| `saveForRevision(key, value)` | tool→server | Store data for revision runs |
| `getRevisionData()` | server→ | Retrieve stored revision data |
| `clearRevisionData()` | server→ | Reset on fresh build |
| `revisionAvailable(count, max)` | server→browser | Revision button state |
| `reviseStart(count, max)` | server→browser | Revision starting |
| `reviseLimit()` | server→browser | Max revisions reached |

## WebSocket Message Protocol

### Server → Browser

| `type` | Payload | Description |
|---|---|---|
| `stage` | `{ step, label }` | Pipeline step activated |
| `question` | `{ id, question, choices? }` | User input needed |
| `upload_request` | `{ id, label, accept }` | File upload needed |
| `log` | `{ message }` | Status log line |
| `thinking` | — | Model is processing |
| `thinking_end` | — | Model done processing |
| `stream_start` | `{ label? }` | Streaming begins |
| `stream_chunk` | `{ chunk }` | Streaming text chunk |
| `stream_end` | — | Streaming complete |
| `done` | `{ label }` | Step complete |
| `complete` | `{ slug, previewPath }` | Build finished |
| `revision_available` | `{ count, max }` | Revision button state |
| `revise_start` | `{ count, max }` | Revision run starting |
| `revise_limit` | — | Max revisions reached |
| `error` | `{ message }` | Error occurred |

### Browser → Server

| `type` | Payload | Description |
|---|---|---|
| `start` | — | Begin fresh build |
| `answer` | `{ value }` | Answer to a question |
| `upload` | `{ id, mimeType, base64, filename }` | File upload |
| `upload_skip` | `{ id }` | Skip file upload |
| `revise` | — | Request a revision |

## Server

**File:** [`src/server/index.mts`](../src/server/index.mts)

- Express serves `public/` (web UI) and `generated-websites/` (output)
- WebSocket server handles all messages
- `revisionState` stored at module level — persists across WebSocket reconnections
- Fresh `start` clears revision state and agentIO session data
- `revise` runs `runRevision()` with stored business data, increments counter

## Electron

**File:** [`electron/main.js`](../electron/main.js)

Spawns `bun run-agent.mts` as a child process, polls `http://localhost:PORT` until the server
is ready, then opens a `BrowserWindow` pointed at it. Kills the server on app quit.
