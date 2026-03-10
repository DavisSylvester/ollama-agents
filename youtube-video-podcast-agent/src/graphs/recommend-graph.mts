import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { fetchTranscripts } from "../nodes/step-10-fetch-transcripts.mts";
import { analyzeAndRecommend } from "../nodes/step-11-analyze-and-recommend.mts";
import { saveRecommendations } from "../nodes/step-12-save-recommendations.mts";
import type { MappedVideo } from "../types/index.mts";
import type { SearchQuery } from "../types/index.mts";
import type { EnvState } from "../types/index.mts";
import type { TranscriptFetchResult } from "../types/index.mts";
import type { VideoRecommendation } from "../types/index.mts";
import type { RecommendationStats } from "../types/index.mts";

const lastWrite = <T,>(current: T, update: T): T => update ?? current;

const RecommendState = Annotation.Root({
  videos: Annotation<MappedVideo[]>({ reducer: lastWrite, default: () => [] }),
  query: Annotation<SearchQuery | null>({ reducer: lastWrite, default: () => null }),
  envState: Annotation<EnvState | null>({ reducer: lastWrite, default: () => null }),
  step10Result: Annotation<TranscriptFetchResult | null>({ reducer: lastWrite, default: () => null }),
  step11Result: Annotation<VideoRecommendation[] | null>({ reducer: lastWrite, default: () => null }),
  step12Result: Annotation<RecommendationStats | null>({ reducer: lastWrite, default: () => null }),
});

type State = typeof RecommendState.State;
type Update = typeof RecommendState.Update;

const builder = new StateGraph(RecommendState);

builder.addNode("10-fetch-transcripts", async (state: State): Promise<Update> => {
  if (!state.query || !state.envState || !state.videos.length) return {};
  const { file: _file, result } = await fetchTranscripts(
    state.videos,
    state.query,
    state.envState.Language,
  );
  return { step10Result: result };
});

builder.addNode("11-analyze-and-recommend", async (state: State): Promise<Update> => {
  if (!state.step10Result?.ToAnalyze.length || !state.query) return {};
  const { file: _file, result } = await analyzeAndRecommend(
    state.step10Result.ToAnalyze,
    state.query.TopicSlug,
    state.query.QuerySlug,
  );
  return { step11Result: result };
});

builder.addNode("12-save-recommendations", async (state: State): Promise<Update> => {
  if (!state.step11Result || !state.query) return {};
  const { file: _file, result } = await saveRecommendations(
    state.step11Result,
    state.query,
    state.step10Result?.CachedCount ?? 0,
  );
  return { step12Result: result };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b = builder as any;
b.addEdge(START, "10-fetch-transcripts");
b.addEdge("10-fetch-transcripts", "11-analyze-and-recommend");
b.addEdge("11-analyze-and-recommend", "12-save-recommendations");
b.addEdge("12-save-recommendations", END);

export const recommendGraph = builder.compile();
