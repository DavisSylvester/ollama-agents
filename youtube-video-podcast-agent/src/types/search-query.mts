import { z } from "zod";
import type { searchQuerySchema } from "../schemas/search-query-schema.mts";

export type SearchQuery = z.infer<typeof searchQuerySchema>;
