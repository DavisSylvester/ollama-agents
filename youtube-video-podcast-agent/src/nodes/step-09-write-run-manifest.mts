import { join } from "path";
import { mkdir } from "fs/promises";
import { readFileTool } from "../tools/index.mts";
import type { SearchQuery } from "../types/index.mts";
import type { ResolvedSource } from "../types/index.mts";
import type { EnvState } from "../types/index.mts";
import type { ExcludedEntry } from "../types/index.mts";
import type { ManifestEntry } from "../types/index.mts";
import type { RecommendationStats } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/09-write-run-manifest.md");
const outputRoot = join(import.meta.dirname, "../../../docs/youtube/topic");

interface ManifestFile {
  runs: ManifestEntry[];
}

export interface RunStats {
  prompt: string;
  fetched: number;
  afterDateFilter: number;
  afterLanguageFilter: number;
  afterShortsFilter: number;
  newVideosSaved: number;
  excluded: ExcludedEntry[];
  errors: string[];
  recommendation: RecommendationStats | null;
}

export async function writeRunManifest(
  query: SearchQuery,
  resolvedSource: ResolvedSource,
  envState: EnvState,
  stats: RunStats,
): Promise<{ file: string; result: ManifestEntry }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const dir = join(outputRoot, query.TopicSlug);
  await mkdir(dir, { recursive: true });

  const manifestPath = join(dir, "manifest.json");

  let manifest: ManifestFile;
  try {
    const raw = await Bun.file(manifestPath).text();
    manifest = JSON.parse(raw) as ManifestFile;
  } catch {
    manifest = { runs: [] };
  }

  const entry: ManifestEntry = {
    RunAt: new Date().toISOString(),
    Prompt: stats.prompt,
    TopicName: query.TopicSlug,
    QueryName: query.QuerySlug,
    FullQuery: query.FullQuery,
    DataSource: resolvedSource.Source,
    PublishedAfter: query.PublishedAfter,
    MaxResults: query.MaxResults,
    Language: query.Language,
    IncludeShorts: query.IncludeShorts,
    Fetched: stats.fetched,
    AfterDateFilter: stats.afterDateFilter,
    AfterLanguageFilter: stats.afterLanguageFilter,
    AfterShortsFilter: stats.afterShortsFilter,
    NewVideosSaved: stats.newVideosSaved,
    Excluded: stats.excluded,
    Errors: stats.errors,
    Recommendation: stats.recommendation,
  };

  manifest.runs.push(entry);
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

  return { file, result: entry };
}
