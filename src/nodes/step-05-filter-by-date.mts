import { join } from "path";
import { readFileTool } from "../tools/index.mts";
import type { RawVideo } from "../types/index.mts";
import type { ExcludedEntry } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/05-filter-by-date.md");

export async function filterByDate(
  videos: RawVideo[],
  publishedAfter: string,
): Promise<{ file: string; result: RawVideo[]; excluded: ExcludedEntry[] }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const cutoff = new Date(publishedAfter).getTime();
  const result: RawVideo[] = [];
  const excluded: ExcludedEntry[] = [];

  for (const video of videos) {
    if (!video.publishedAt) {
      excluded.push({ Url: video.url, Title: video.title, Reason: "date_out_of_range" });
      continue;
    }
    const published = new Date(video.publishedAt).getTime();
    if (isNaN(published) || published < cutoff) {
      excluded.push({ Url: video.url, Title: video.title, Reason: "date_out_of_range" });
    } else {
      result.push(video);
    }
  }

  return { file, result, excluded };
}
