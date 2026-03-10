import { z } from "zod";
import type { topicInputSchema } from "../schemas/index.mts";

export type TopicInput = z.infer<typeof topicInputSchema>;
