import { researchGraph } from "../graphs/research-graph.mts";
import { recommendGraph } from "../graphs/recommend-graph.mts";
import type { TopicInput } from "../types/index.mts";

export interface TriggerRunResult {
  topicName: string;
  queryName: string;
  success: boolean;
  error?: string;
  newVideosSaved: number;
  recommendationStats: {
    totalAnalyzed: number;
    watchCount: number;
    skipCount: number;
  } | null;
}

export async function runPipelineForTopics(
  topics: TopicInput[],
  lookbackDays?: number,
): Promise<TriggerRunResult[]> {
  const results: TriggerRunResult[] = [];

  for (const topic of topics) {
    const prompt = `Find recent YouTube videos on ${topic.TopicName} ${topic.QueryName}`;
    console.log(`[trigger] running pipeline for: ${topic.TopicName} / ${topic.QueryName}`);

    try {
      const researchState = await researchGraph.invoke(
        { prompt },
        // Pass lookbackDays override via env only if provided — graph reads from env step
      );

      const recommendState = await recommendGraph.invoke({
        videos: researchState.step07Result ?? [],
        query: researchState.step03Result,
        envState: researchState.step01Result,
      });

      results.push({
        topicName: topic.TopicName,
        queryName: topic.QueryName,
        success: true,
        newVideosSaved: researchState.step08Result ?? 0,
        recommendationStats: recommendState.step12Result
          ? {
              totalAnalyzed: recommendState.step12Result.TotalAnalyzed,
              watchCount: recommendState.step12Result.WatchCount,
              skipCount: recommendState.step12Result.SkipCount,
            }
          : null,
      });
    } catch (err) {
      const message = (err as Error).message;
      console.error(`[trigger] pipeline failed for ${topic.TopicName}/${topic.QueryName}:`, message);
      results.push({
        topicName: topic.TopicName,
        queryName: topic.QueryName,
        success: false,
        error: message,
        newVideosSaved: 0,
        recommendationStats: null,
      });
    }
  }

  return results;
}
