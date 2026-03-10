import { z } from "zod";
import type { recommendationFileSchema } from "../schemas/index.mts";

export type RecommendationFile = z.infer<typeof recommendationFileSchema>;
