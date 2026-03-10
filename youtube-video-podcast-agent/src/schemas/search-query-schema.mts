import { z } from "zod";

export const searchQuerySchema = z.object({
  FullQuery: z.string().describe("Combined topic + query string e.g. 'Claude Code Ralph Loop'"),
  TopicSlug: z.string().describe("URL/filesystem-safe topic slug e.g. 'claude-code'"),
  QuerySlug: z.string().describe("URL/filesystem-safe query slug e.g. 'ralph-loop'"),
  PublishedAfter: z.string().describe("ISO 8601 date — lookback window start"),
  MaxResults: z.number().int().describe("Max videos to fetch, clamped 1–50"),
  Language: z.string().describe("BCP-47 language code e.g. 'en'"),
  IncludeShorts: z.boolean().describe("Whether to include YouTube Shorts"),
  SourceUrl: z.string().nullable().describe("Webscrape URL, or null when using an API source"),
});
