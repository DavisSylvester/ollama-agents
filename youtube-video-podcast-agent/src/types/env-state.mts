import { z } from "zod";
import type { envStateSchema } from "../schemas/env-state-schema.mts";

export type EnvState = z.infer<typeof envStateSchema>;
