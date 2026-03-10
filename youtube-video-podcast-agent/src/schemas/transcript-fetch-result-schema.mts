import { z } from "zod";
import { videoWithTranscriptSchema } from "./video-with-transcript-schema.mts";

export const transcriptFetchResultSchema = z.object({
  ToAnalyze: z.array(videoWithTranscriptSchema).describe("Videos that need LLM analysis"),
  CachedCount: z.number().int().describe("Videos skipped because a recommendation already exists"),
});
