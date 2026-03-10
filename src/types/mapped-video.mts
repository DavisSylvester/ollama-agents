import { z } from "zod";
import type { mappedVideoSchema } from "../schemas/mapped-video-schema.mts";

export type MappedVideo = z.infer<typeof mappedVideoSchema>;
