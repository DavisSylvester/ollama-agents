import { z } from "zod";
import { mappedVideoSchema } from "./mapped-video-schema.mts";

export const transcriptSourceSchema = z.enum(["timedtext-api", "ytInitialPlayerResponse"]);

export const videoWithTranscriptSchema = z.object({
  Video: mappedVideoSchema,
  Transcript: z.string().nullable().describe("Full plain-text transcript, null if unavailable"),
  TranscriptSource: transcriptSourceSchema.nullable(),
});
