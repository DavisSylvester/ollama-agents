import { join } from "path";
import { readFileTool } from "../tools/index.mts";
import type { RawVideo } from "../types/index.mts";
import type { MappedVideo } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/07-map-to-video-interface.md");

export async function mapToVideoInterface(
  videos: RawVideo[],
  includeShorts: boolean,
): Promise<{ file: string; result: MappedVideo[] }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const filtered = includeShorts ? videos : videos.filter((v) => !v.isShort);

  const result: MappedVideo[] = filtered.map((v) => ({
    Title: v.title,
    ChannelId: v.channelId,
    ChannelTitle: v.channelTitle,
    // publishedAt is non-null here — nulls were excluded in step 05
    PublishedAt: v.publishedAt ?? "",
    Url: v.url,
    Description: v.description,
    ThumbnailUrl: v.thumbnailUrl,
    IsShort: v.isShort ? 1 : 0,
    // defaultLanguage is resolved and non-null after step 06
    DefaultLanguage: v.defaultLanguage ?? "",
  }));

  return { file, result };
}
