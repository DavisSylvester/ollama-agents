import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../env.mts';

const THRESHOLD = 0.60;
let cachedContextSize: number | null = null;

/**
 * Fetch the model's configured num_ctx from Ollama.
 * Falls back to 32768 (qwen3 default) if the API call fails.
 */
export async function warmContextSize(): Promise<void> {
  try {
    const res = await fetch(`${env.OLLAMA_HOST}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: env.OLLAMA_MODEL }),
    });
    const data = await res.json() as { parameters?: string; modelinfo?: Record<string, unknown> };
    // Try parameters string first: "num_ctx 32768"
    const paramMatch = data.parameters?.match(/num_ctx\s+(\d+)/);
    if (paramMatch?.[1]) {
      cachedContextSize = parseInt(paramMatch[1], 10);
      return;
    }
    // Fall back to modelinfo.llama.context_length
    const ctxLen = data.modelinfo?.['llama.context_length'];
    if (typeof ctxLen === 'number') {
      cachedContextSize = ctxLen;
      return;
    }
  } catch { /* ignore — use default */ }
  cachedContextSize = 32768; // qwen3 default
}

/** Extract prompt token count from an Ollama AIMessage. */
function promptTokens(response: AIMessage): number | null {
  const meta = response.response_metadata as Record<string, unknown> | undefined;
  const v = meta?.['prompt_eval_count'];
  return typeof v === 'number' ? v : null;
}

/**
 * Log context usage to UI after every agent node invocation.
 * At >= 60% writes a checkpoint JSON of all tool outputs collected so far.
 */
export async function checkContext(
  response: AIMessage,
  messages: readonly BaseMessage[],
  log: (msg: string) => void,
): Promise<void> {
  const tokens = promptTokens(response);
  if (tokens === null || !cachedContextSize) return;

  const pct = tokens / cachedContextSize;
  const pctStr = `${(pct * 100).toFixed(1)}%`;
  const ctxStr = `${tokens.toLocaleString()} / ${cachedContextSize.toLocaleString()} tokens`;

  if (pct >= THRESHOLD) {
    log(`⚠ Context: ${pctStr} (${ctxStr}) — checkpointing`);
    await writeCheckpoint(messages, pct);
    log(`Checkpoint written to generated-websites/checkpoints/`);
  } else {
    log(`Context: ${pctStr} (${ctxStr})`);
  }
}

/** Serialise all ToolMessage outputs collected so far and save to disk. */
async function writeCheckpoint(
  messages: readonly BaseMessage[],
  contextPercent: number,
): Promise<void> {
  const toolOutputs = messages
    .filter((m) => m._getType() === 'tool')
    .map((m) => ({ name: (m as AIMessage & { name?: string }).name ?? 'tool', content: m.content }));

  const dir = resolve(process.cwd(), 'generated-websites', 'checkpoints');
  await mkdir(dir, { recursive: true });

  const filename = `checkpoint-${Date.now()}.json`;
  await writeFile(
    resolve(dir, filename),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      contextPercent: parseFloat((contextPercent * 100).toFixed(1)),
      stepCount: toolOutputs.length,
      toolOutputs,
    }, null, 2),
  );
}