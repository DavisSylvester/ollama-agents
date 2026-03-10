import { z } from "zod";
import type { excludedEntrySchema, recommendationStatsSchema, manifestEntrySchema } from "../schemas/manifest-entry-schema.mts";

export type ExcludedEntry = z.infer<typeof excludedEntrySchema>;
export type RecommendationStats = z.infer<typeof recommendationStatsSchema>;
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
