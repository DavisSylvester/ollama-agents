import { z } from "zod";

// Step 07 output — isShort stored as 0/1, defaultLanguage always resolved
export const mappedVideoSchema = z.object({
  Title: z.string(),
  ChannelId: z.string().nullable(),
  ChannelTitle: z.string().nullable(),
  PublishedAt: z.string().describe("ISO 8601 date string"),
  Url: z.string(),
  Description: z.string().nullable(),
  ThumbnailUrl: z.string().nullable(),
  IsShort: z.union([z.literal(0), z.literal(1)]).describe("0 = regular video, 1 = Short"),
  DefaultLanguage: z.string().describe("Resolved language — never null at this stage"),
});
