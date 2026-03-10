import { z } from "zod";

export const videoSearchQuery = z.object({
  search_query: z.string().describe("Describe the video you want to find, including any relevant keywords, topics, or themes."),
  topic: z.string().describe("The main topic or category of the video, such as 'technology', 'claude', 'vscode' etc."),
  subTopic: z.string().describe(`A more specific aspect of the topic, such as 'AI agents', 'code editor features', etc. This helps narrow down the search results to videos that are more relevant to your interests.`),
  lookBackPeriod: z.number().nullable().describe("The number of days to look back for videos. For example, if you want to find videos from the last week, you would set this to 7. min value is 1 day. max value is 30 days. default value is 7 days."),
  language: z.string().nullable().describe("The language of the videos you want to find. For example, 'English', 'Spanish', etc. If null, it will search for videos in English."),
  allowShorts: z.boolean().default(true).describe("Whether to include YouTube Shorts in the search results. Shorts are short-form videos that are typically less than 60 seconds long. If true, the search will include both regular videos and Shorts. If false, it will only include regular videos."),
});