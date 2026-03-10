import { ollamaModel } from "../models/index.mts";
import { videoSearchQuery } from "../schemas/index.mts";

export const videoLlmAgent = ollamaModel.withStructuredOutput(videoSearchQuery);