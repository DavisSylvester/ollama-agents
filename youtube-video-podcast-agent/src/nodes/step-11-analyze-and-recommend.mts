import { join } from "path";
import { z } from "zod";
import { readFileTool } from "../tools/index.mts";
import { ollamaModel } from "../models/index.mts";
import type { VideoWithTranscript } from "../types/index.mts";
import type { VideoRecommendation } from "../types/index.mts";

const specFile = join(
  import.meta.dirname,
  "../workflows/youtube-search/recommend/11-analyze-and-recommend.md",
);

// LLM returns these fields; we derive Recommendation and Confidence from the score
const llmOutputSchema = z.object({
  relevanceScore: z.number().int().min(0).max(100),
  summary: z.string(),
  reasons: z.array(z.string()),
});

function deriveConfidence(score: number, transcriptAvailable: boolean): VideoRecommendation["Confidence"] {
  if (!transcriptAvailable || score < 40) return "low";
  if (score >= 70) return "high";
  return "medium";
}

async function analyzeVideo(
  item: VideoWithTranscript,
  topicName: string,
  queryName: string,
): Promise<VideoRecommendation> {
  const { Video: video, Transcript: transcript } = item;
  const transcriptSection = transcript
    ? `Transcript:\n${transcript.slice(0, 4000)}`
    : "Transcript: not available — analysis based on metadata only";

  const prompt =
    `You are a video recommendation assistant. Determine whether the user should watch this video.\n\n` +
    `Topic: ${topicName}\nQuery: ${queryName}\n\n` +
    `Video Metadata:\n` +
    `- Title: ${video.Title}\n` +
    `- Channel: ${video.ChannelTitle ?? "unknown"}\n` +
    `- Published: ${video.PublishedAt}\n` +
    `- Description: ${(video.Description ?? "").slice(0, 500)}\n\n` +
    `${transcriptSection}\n\n` +
    `Scoring: 80–100 directly covers topic, 60–79 relevant context, 40–59 tangential, 0–39 off-topic.`;

  let score = 0;
  let summary = "";
  let reasons: string[] = ["analysis_failed"];

  try {
    const result = await ollamaModel.withStructuredOutput(llmOutputSchema).invoke([
      { role: "user", content: prompt },
    ]) as z.infer<typeof llmOutputSchema>;
    score = result.relevanceScore;
    summary = result.summary;
    reasons = result.reasons;
  } catch (err) {
    console.error(`[step-11] LLM error for ${video.Url}:`, (err as Error).message);
  }

  const transcriptAvailable = transcript !== null;
  return {
    Url: video.Url,
    Title: video.Title,
    Recommendation: score >= 60 ? "watch" : "skip",
    Confidence: deriveConfidence(score, transcriptAvailable),
    RelevanceScore: score,
    Summary: summary,
    Reasons: reasons,
    TranscriptAvailable: transcriptAvailable,
    AnalyzedAt: new Date().toISOString(),
  };
}

export async function analyzeAndRecommend(
  toAnalyze: VideoWithTranscript[],
  topicName: string,
  queryName: string,
): Promise<{ file: string; result: VideoRecommendation[] }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const result: VideoRecommendation[] = [];
  for (const item of toAnalyze) {
    result.push(await analyzeVideo(item, topicName, queryName));
  }

  return { file, result };
}
