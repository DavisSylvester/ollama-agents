import { z } from "zod";

export const dataSourceSchema = z.enum(["youtube-api", "tavily", "webscrape"]);

export const resolvedSourceSchema = z.object({
  Source: dataSourceSchema.describe("The selected data source for this run"),
  ApiKey: z.string().nullable().describe("API key for the source, or null for webscrape"),
});
