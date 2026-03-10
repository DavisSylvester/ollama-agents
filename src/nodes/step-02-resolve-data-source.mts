import { join } from "path";
import { readFileTool } from "../tools/index.mts";
import type { EnvState } from "../types/index.mts";
import type { ResolvedSource } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/02-resolve-data-source.md");

export async function resolveDataSource(envState: EnvState): Promise<{ file: string; result: ResolvedSource }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  let result: ResolvedSource;
  if (envState.YoutubeApiKey) {
    result = { Source: "youtube-api", ApiKey: envState.YoutubeApiKey };
  } else if (envState.TavilyApiKey) {
    result = { Source: "tavily", ApiKey: envState.TavilyApiKey };
  } else {
    result = { Source: "webscrape", ApiKey: null };
  }

  return { file, result };
}
