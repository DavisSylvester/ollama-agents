import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { loadTopics } from "../nodes/trigger-load-topics.mts";
import { runPipelineForTopics } from "../nodes/trigger-run-pipeline.mts";
import type { TopicInput } from "../types/index.mts";
import type { TriggerRunResult } from "../nodes/index.mts";

const lastWrite = <T,>(current: T, update: T): T => update ?? current;

const TriggerState = Annotation.Root({
  // Optional override prompt prefix — not used for topic lookup, kept for Studio invocation context
  prompt: Annotation<string>({ reducer: lastWrite, default: () => "" }),
  topics: Annotation<TopicInput[] | null>({ reducer: lastWrite, default: () => null }),
  results: Annotation<TriggerRunResult[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

type State = typeof TriggerState.State;
type Update = typeof TriggerState.Update;

const builder = new StateGraph(TriggerState);

builder.addNode("load-topics", async (): Promise<Update> => {
  const topics = await loadTopics();
  console.log(`[trigger-graph] loaded ${topics.length} topic(s) from config/topics.json`);
  return { topics };
});

builder.addNode("run-pipeline", async (state: State): Promise<Update> => {
  const topics = state.topics ?? [];
  if (!topics.length) {
    console.warn("[trigger-graph] no topics found — skipping pipeline");
    return { results: [] };
  }
  const results = await runPipelineForTopics(topics);
  return { results };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b = builder as any;
b.addEdge(START, "load-topics");
b.addEdge("load-topics", "run-pipeline");
b.addEdge("run-pipeline", END);

export const triggerGraph = builder.compile();
