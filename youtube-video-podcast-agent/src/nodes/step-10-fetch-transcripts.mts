import { join } from "path";
import { readFileTool, fetchTranscriptTool } from "../tools/index.mts";
import type { MappedVideo } from "../types/index.mts";
import type { SearchQuery } from "../types/index.mts";
import type { TranscriptFetchResult } from "../types/index.mts";
import type { VideoWithTranscript } from "../types/index.mts";
import type { RecommendationFile } from "../types/index.mts";

const specFile = join(
  import.meta.dirname,
  "../workflows/youtube-search/recommend/10-fetch-transcripts.md",
);
const outputRoot = join(import.meta.dirname, "../../../docs/youtube/topic");

// Load existing recommendation file — only skip videos with valid (non-failed) analysis
async function loadCachedUrls(topicSlug: string, querySlug: string): Promise<Set<string>> {
  const path = join(outputRoot, topicSlug, `${querySlug}.recommendations.json`);
  try {
    const raw = await Bun.file(path).text();
    const data = JSON.parse(raw) as RecommendationFile;
    return new Set(
      data.Recommendations
        .filter((r) => !r.Reasons.includes("analysis_failed"))
        .map((r) => r.Url),
    );
  } catch {
    return new Set();
  }
}

export async function fetchTranscripts(
  videos: MappedVideo[],
  query: SearchQuery,
  language: string,
): Promise<{ file: string; result: TranscriptFetchResult }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const cachedUrls = await loadCachedUrls(query.TopicSlug, query.QuerySlug);
  const pending = videos.filter((v) => !cachedUrls.has(v.Url));
  const cachedCount = videos.length - pending.length;

  const toAnalyze: VideoWithTranscript[] = [];

  for (const video of pending) {
    const transcriptText = await fetchTranscriptTool.invoke({ url: video.Url, language });
    const isError = transcriptText.startsWith("Error:");

    toAnalyze.push({
      Video: video,
      Transcript: isError ? null : transcriptText,
      TranscriptSource: isError ? null : "timedtext-api",
    });
  }

  return { file, result: { ToAnalyze: toAnalyze, CachedCount: cachedCount } };
}
