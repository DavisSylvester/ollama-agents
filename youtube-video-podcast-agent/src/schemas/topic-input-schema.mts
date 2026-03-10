import { z } from "zod";

export const topicInputSchema = z.object({
  TopicName: z.string().describe("Primary topic to search for, e.g. 'Claude Code'"),
  QueryName: z.string().describe("Secondary search modifier, e.g. 'Ralph Loop'"),
});
