import { ChatOllama } from '@langchain/ollama';
import { env } from '../env.mts';

/**
 * Shared ChatOllama instance used by all tools and the agent node.
 * The orchestrator agent binds tools to this model.
 * Individual tools (copy, design, html) invoke a separate instance directly.
 */
export function createModel(temperature = 0.7): ChatOllama {
  return new ChatOllama({
    baseUrl: env.OLLAMA_HOST,
    model: env.OLLAMA_MODEL,
    temperature,
  });
}

/** Low-temperature model for structured JSON generation. */
export const structuredModel = createModel(0.3);

/** Standard model for prose and HTML generation. */
export const chattingModel = createModel(0.7);
