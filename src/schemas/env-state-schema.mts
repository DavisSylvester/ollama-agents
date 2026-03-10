import { z } from "zod";

const maxResults = (val: number) => Math.min(50, Math.max(1, val));

export const envStateSchema = z.object({
  YoutubeApiKey: z.string().nullable().describe("YOUTUBE_API_KEY — null if missing or empty"),
  TavilyApiKey: z.string().nullable().describe("TAVILY_API_KEY — null if missing or empty"),
  WebScrapingUsername: z.string().nullable().describe("WEB_SCRAPING_USERNAME — null if missing or empty"),
  WebScrapingPassword: z.string().nullable().describe("WEB_SCRAPING_PASSWORD — null if missing or empty"),
  MaxResults: z
    .number()
    .int()
    .transform(maxResults)
    .default(50)
    .describe("MAX_RESULTS — integer clamped between 1–50, defaults to 50"),
  LookbackDays: z
    .number()
    .int()
    .default(7)
    .describe("LOOKBACK_DAYS — number of days to look back, defaults to 7"),
  Language: z.string().default("en").describe("LANGUAGE — BCP-47 language code, defaults to 'en'"),
  IncludeShorts: z.boolean().default(true).describe("INCLUDE_SHORTS — whether to include YouTube Shorts, defaults to true"),
});
