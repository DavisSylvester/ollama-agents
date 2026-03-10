import { z } from "zod";

export const videoRecommendationSchema = z.object({
  Url: z.string(),
  Title: z.string(),
  Recommendation: z.enum(["watch", "skip"]),
  Confidence: z.enum(["high", "medium", "low"]),
  RelevanceScore: z.number().int().min(0).max(100),
  Summary: z.string().describe("2–3 sentence summary of what the video covers"),
  Reasons: z.array(z.string()).describe("Bullet points justifying the recommendation"),
  TranscriptAvailable: z.boolean(),
  AnalyzedAt: z.string().describe("ISO 8601 timestamp"),
});
