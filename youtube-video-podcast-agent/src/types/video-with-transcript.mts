import { z } from "zod";
import type {
  videoWithTranscriptSchema,
  transcriptSourceSchema,
  transcriptFetchResultSchema,
} from "../schemas/index.mts";

export type TranscriptSource = z.infer<typeof transcriptSourceSchema>;
export type VideoWithTranscript = z.infer<typeof videoWithTranscriptSchema>;
export type TranscriptFetchResult = z.infer<typeof transcriptFetchResultSchema>;
