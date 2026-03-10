import { z } from "zod";
import type { videoRecommendationSchema } from "../schemas/index.mts";

export type VideoRecommendation = z.infer<typeof videoRecommendationSchema>;
