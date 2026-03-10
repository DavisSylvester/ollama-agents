import { z } from "zod";
import { videoRecommendationSchema } from "./video-recommendation-schema.mts";

export const recommendationFileSchema = z.object({
  TopicName: z.string(),
  QueryName: z.string(),
  GeneratedAt: z.string().describe("ISO 8601 timestamp of this run"),
  Recommendations: z.array(videoRecommendationSchema),
});
