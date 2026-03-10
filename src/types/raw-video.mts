import { z } from 'zod';
import type { VideoSchema } from "../schemas/video-schema.mts";

export type RawVideo = z.infer<typeof VideoSchema>;