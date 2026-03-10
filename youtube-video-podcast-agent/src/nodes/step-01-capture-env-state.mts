import { join } from "path";
import { readFileTool, readEnvTool } from "../tools/index.mts";
import { envStateSchema } from "../schemas/index.mts";
import type { EnvState } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/01-capture-env-state.md");
const dotEnvPath = join(import.meta.dirname, "../../../.env");

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return value.toLowerCase() !== "false" && value !== "0";
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? "", 10);
  return isNaN(parsed) ? fallback : parsed;
}

export async function captureEnvState(): Promise<{ file: string; result: EnvState }> {
  const [file, envJson] = await Promise.all([
    readFileTool.invoke({ file_path: specFile }),
    readEnvTool.invoke({ env_file_path: dotEnvPath }),
  ]);

  // readEnvTool returns JSON with { sources, variables }
  const { variables } = JSON.parse(envJson) as { sources: string[]; variables: Record<string, string> };
  const get = (key: string): string | null => variables[key]?.trim() || null;

  const result = envStateSchema.parse({
    YoutubeApiKey: get("YOUTUBE_API_KEY"),
    TavilyApiKey: get("TAVILY_API_KEY"),
    WebScrapingUsername: get("WEB_SCRAPING_USERNAME"),
    WebScrapingPassword: get("WEB_SCRAPING_PASSWORD"),
    MaxResults: parseInteger(variables["MAX_RESULTS"], 50),
    LookbackDays: parseInteger(variables["LOOKBACK_DAYS"], 7),
    Language: variables["LANGUAGE"] ?? "en",
    IncludeShorts: parseBoolean(variables["INCLUDE_SHORTS"], true),
  });

  return { file, result };
}
