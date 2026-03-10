import { z } from "zod";
import type { dataSourceSchema, resolvedSourceSchema } from "../schemas/resolved-source-schema.mts";

export type DataSource = z.infer<typeof dataSourceSchema>;
export type ResolvedSource = z.infer<typeof resolvedSourceSchema>;
