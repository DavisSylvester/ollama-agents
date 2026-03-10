import { z } from "zod";
import { dataSourceSchema } from "./resolved-source-schema.mts";

export const excludedEntrySchema = z.object({
  Url: z.string(),
  Title: z.string().nullable(),
  Reason: z.enum(["date_out_of_range", "language_undetectable", "language_mismatch", "duplicate"]),
});

export const recommendationStatsSchema = z.object({
  CachedCount: z.number().int().describe("Videos skipped — recommendation already existed"),
  TranscriptsFetched: z.number().int(),
  TranscriptsMissing: z.number().int(),
  TotalAnalyzed: z.number().int(),
  WatchCount: z.number().int(),
  SkipCount: z.number().int(),
  HighConfidence: z.number().int(),
  MediumConfidence: z.number().int(),
  LowConfidence: z.number().int(),
  Upserted: z.number().int().describe("Existing recommendations replaced"),
  Added: z.number().int().describe("New recommendations written for first time"),
});

export const manifestEntrySchema = z.object({
  RunAt: z.string().describe("ISO 8601 timestamp"),
  Prompt: z.string().describe("Raw prompt that triggered this run"),
  TopicName: z.string(),
  QueryName: z.string(),
  FullQuery: z.string(),
  DataSource: dataSourceSchema,
  PublishedAfter: z.string(),
  MaxResults: z.number().int(),
  Language: z.string(),
  IncludeShorts: z.boolean(),
  Fetched: z.number().int().describe("Raw count from step 04"),
  AfterDateFilter: z.number().int().describe("Count after step 05"),
  AfterLanguageFilter: z.number().int().describe("Count after step 06"),
  AfterShortsFilter: z.number().int().describe("Count after step 07"),
  NewVideosSaved: z.number().int().describe("Deduplicated count from step 08"),
  Excluded: z.array(excludedEntrySchema),
  Errors: z.array(z.string()),
  Recommendation: recommendationStatsSchema.nullable(),
});
