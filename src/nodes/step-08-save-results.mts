import { join } from "path";
import { mkdir } from "fs/promises";
import { readFileTool } from "../tools/index.mts";
import type { MappedVideo } from "../types/index.mts";
import type { SearchQuery } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/08-save-results.md");

// Root output directory — relative to the project root (two levels up from src/)
const outputRoot = join(import.meta.dirname, "../../../docs/youtube/topic");

interface TopicResultFile {
  topicName: string;
  queryName: string;
  videos: MappedVideo[];
}

export async function saveResults(
  videos: MappedVideo[],
  query: SearchQuery,
): Promise<{ file: string; result: number }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const dir = join(outputRoot, query.TopicSlug);
  await mkdir(dir, { recursive: true });

  const filePath = join(dir, `${query.QuerySlug}.json`);

  let existing: TopicResultFile;
  try {
    const raw = await Bun.file(filePath).text();
    existing = JSON.parse(raw) as TopicResultFile;
  } catch {
    existing = { topicName: query.TopicSlug, queryName: query.QuerySlug, videos: [] };
  }

  const existingUrls = new Set(existing.videos.map((v) => v.Url));
  const newVideos = videos.filter((v) => !existingUrls.has(v.Url));

  existing.videos.push(...newVideos);
  await Bun.write(filePath, JSON.stringify(existing, null, 2));

  return { file, result: newVideos.length };
}
