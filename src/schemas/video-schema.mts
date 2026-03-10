import { z } from "zod";

export const VideoSchema = z.object({
  title: z.string(),
  channelId: z.string().nullable(),
  channelTitle: z.string().nullable(),
  publishedAt: z.string().nullable(),
  url: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  defaultLanguage: z.string().nullable(),
  defaultAudioLanguage: z.string().nullable(),
  isShort: z.boolean().default(false),
});
