import { join } from "path";
import { mkdir } from "fs/promises";
import { readFileTool } from "../tools/index.mts";
import type { VideoRecommendation } from "../types/index.mts";
import type { RecommendationFile } from "../types/index.mts";
import type { RecommendationStats } from "../types/index.mts";
import type { SearchQuery } from "../types/index.mts";

const specFile = join(
  import.meta.dirname,
  "../workflows/youtube-search/recommend/12-save-recommendations.md",
);
const outputRoot = join(import.meta.dirname, "../../../docs/youtube/topic");

export async function saveRecommendations(
  incoming: VideoRecommendation[],
  query: SearchQuery,
  cachedCount: number,
): Promise<{ file: string; result: RecommendationStats }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const dir = join(outputRoot, query.TopicSlug);
  await mkdir(dir, { recursive: true });

  const filePath = join(dir, `${query.QuerySlug}.recommendations.json`);

  let existing: RecommendationFile;
  try {
    const raw = await Bun.file(filePath).text();
    existing = JSON.parse(raw) as RecommendationFile;
  } catch {
    existing = {
      TopicName: query.TopicSlug,
      QueryName: query.QuerySlug,
      GeneratedAt: new Date().toISOString(),
      Recommendations: [],
    };
  }

  const existingMap = new Map(existing.Recommendations.map((r) => [r.Url, r]));

  let upserted = 0;
  let added = 0;

  for (const rec of incoming) {
    if (existingMap.has(rec.Url)) {
      upserted++;
    } else {
      added++;
    }
    existingMap.set(rec.Url, rec);
  }

  // watch first, then by relevanceScore descending
  const sorted = [...existingMap.values()].sort((a, b) => {
    if (a.Recommendation !== b.Recommendation) {
      return a.Recommendation === "watch" ? -1 : 1;
    }
    return b.RelevanceScore - a.RelevanceScore;
  });

  existing.Recommendations = sorted;
  existing.GeneratedAt = new Date().toISOString();

  await Bun.write(filePath, JSON.stringify(existing, null, 2));

  const transcriptsFetched = incoming.filter((r) => r.TranscriptAvailable).length;
  const transcriptsMissing = incoming.length - transcriptsFetched;

  const result: RecommendationStats = {
    CachedCount: cachedCount,
    TranscriptsFetched: transcriptsFetched,
    TranscriptsMissing: transcriptsMissing,
    TotalAnalyzed: incoming.length,
    WatchCount: incoming.filter((r) => r.Recommendation === "watch").length,
    SkipCount: incoming.filter((r) => r.Recommendation === "skip").length,
    HighConfidence: incoming.filter((r) => r.Confidence === "high").length,
    MediumConfidence: incoming.filter((r) => r.Confidence === "medium").length,
    LowConfidence: incoming.filter((r) => r.Confidence === "low").length,
    Upserted: upserted,
    Added: added,
  };

  return { file, result };
}
