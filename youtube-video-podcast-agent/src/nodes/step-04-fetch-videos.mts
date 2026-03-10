import { join } from "path";
import { readFileTool } from "../tools/index.mts";
import type { EnvState } from "../types/index.mts";
import type { SearchQuery } from "../types/index.mts";
import type { ResolvedSource } from "../types/index.mts";
import type { RawVideo } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/04-fetch-videos.md");

// YouTube API response shapes (minimal)
interface YtSearchItem {
  id: { videoId: string };
}
interface YtSearchResponse {
  items?: YtSearchItem[];
}
interface YtVideoItem {
  id: string;
  snippet: {
    title: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    description?: string;
    thumbnails?: { default?: { url: string } };
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
  contentDetails?: { duration: string };
}
interface YtVideosResponse {
  items?: YtVideoItem[];
}

// Tavily response shapes (minimal)
interface TavilyResult {
  title: string;
  url: string;
  content?: string;
  published_date?: string;
}
interface TavilyResponse {
  results?: TavilyResult[];
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}

function estimatePublishedAt(relativeText: string | undefined): string | null {
  if (!relativeText) return null;
  const match = relativeText.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) return null;
  const n = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const msMap: Record<string, number> = {
    second: 1_000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
  };
  return new Date(Date.now() - (msMap[unit] ?? 0) * n).toISOString();
}

async function fetchFromYoutubeApi(query: SearchQuery, apiKey: string): Promise<RawVideo[]> {
  const searchParams = new URLSearchParams({
    q: query.FullQuery,
    type: "video",
    publishedAfter: `${query.PublishedAfter}T00:00:00Z`,
    maxResults: String(query.MaxResults),
    relevanceLanguage: query.Language,
    part: "snippet",
    key: apiKey,
  });

  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`);
  if (!searchRes.ok) throw new Error(`YouTube search API error: ${searchRes.status}`);
  const searchData = (await searchRes.json()) as YtSearchResponse;

  const videoIds = (searchData.items ?? []).map((i) => i.id.videoId).filter(Boolean);
  if (!videoIds.length) return [];

  const detailsParams = new URLSearchParams({
    id: videoIds.join(","),
    part: "snippet,contentDetails",
    key: apiKey,
  });
  const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams}`);
  if (!detailsRes.ok) throw new Error(`YouTube videos.list API error: ${detailsRes.status}`);
  const detailsData = (await detailsRes.json()) as YtVideosResponse;

  return (detailsData.items ?? []).map((item) => ({
    title: item.snippet.title,
    channelId: item.snippet.channelId ?? null,
    channelTitle: item.snippet.channelTitle ?? null,
    publishedAt: item.snippet.publishedAt ?? null,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    description: item.snippet.description ?? null,
    thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
    defaultLanguage: item.snippet.defaultLanguage ?? null,
    defaultAudioLanguage: item.snippet.defaultAudioLanguage ?? null,
    isShort: parseDurationSeconds(item.contentDetails?.duration ?? "") <= 60,
  }));
}

async function fetchFromTavily(query: SearchQuery, apiKey: string): Promise<RawVideo[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: query.FullQuery,
      search_depth: "basic",
      max_results: query.MaxResults,
      include_domains: ["youtube.com"],
    }),
  });
  if (!res.ok) throw new Error(`Tavily search API error: ${res.status}`);
  const data = (await res.json()) as TavilyResponse;

  return (data.results ?? [])
    .filter((r) => r.url.includes("youtube.com/watch"))
    .map((r) => ({
      title: r.title,
      channelId: null,
      channelTitle: null,
      publishedAt: r.published_date ?? null,
      url: r.url,
      description: r.content ?? null,
      thumbnailUrl: null,
      defaultLanguage: null,
      defaultAudioLanguage: null,
      isShort: false,
    }));
}

async function fetchFromWebscrape(query: SearchQuery, envState: EnvState): Promise<RawVideo[]> {
  const { WebScrapingUsername: username, WebScrapingPassword: password } = envState;

  let fetchOptions: RequestInit = {};
  if (username && password) {
    const port = 10001 + Math.floor(Math.random() * 7);
    const proxyUrl = `http://${username}:${password}@gate.decodo.com:${port}`;
    // Bun supports proxy as an extended fetch option
    (fetchOptions as Record<string, unknown>)["proxy"] = proxyUrl;
  } else {
    console.warn("[step-04] No proxy credentials found — attempting direct fetch");
  }

  const res = await fetch(query.SourceUrl!, fetchOptions);
  if (!res.ok) throw new Error(`Webscrape fetch error: ${res.status}`);
  const html = await res.text();

  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!match) return [];

  let ytData: Record<string, unknown>;
  try {
    ytData = JSON.parse(match[1]!) as Record<string, unknown>;
  } catch {
    return [];
  }

  // Walk the nested structure to reach videoRenderer items
  const sections: unknown[] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ytData as any)?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents ?? [];

  const videos: RawVideo[] = [];
  for (const section of sections) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: unknown[] = (section as any)?.itemSectionRenderer?.contents ?? [];
    for (const item of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vr = (item as any)?.videoRenderer;
      if (!vr?.videoId) continue;

      const videoId: string = vr.videoId;
      const title: string = vr.title?.runs?.[0]?.text ?? "";
      const channelId: string | null =
        vr.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null;
      const channelTitle: string | null = vr.longBylineText?.runs?.[0]?.text ?? null;
      const description: string | null =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join("") ?? null;
      const thumbnailUrl: string | null = vr.thumbnail?.thumbnails?.[0]?.url ?? null;
      const isShortBadge: boolean =
        vr.badges?.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b: any) => b?.metadataBadgeRenderer?.label === "Shorts",
        ) ?? false;

      videos.push({
        title,
        channelId,
        channelTitle,
        publishedAt: estimatePublishedAt(vr.publishedTimeText?.simpleText),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description,
        thumbnailUrl,
        defaultLanguage: null,
        defaultAudioLanguage: null,
        isShort: isShortBadge,
      });
    }
  }

  return videos;
}

export async function fetchVideos(
  query: SearchQuery,
  resolvedSource: ResolvedSource,
  envState: EnvState,
): Promise<{ file: string; result: RawVideo[] }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  let result: RawVideo[];
  try {
    if (resolvedSource.Source === "youtube-api" && resolvedSource.ApiKey) {
      result = await fetchFromYoutubeApi(query, resolvedSource.ApiKey);
    } else if (resolvedSource.Source === "tavily" && resolvedSource.ApiKey) {
      result = await fetchFromTavily(query, resolvedSource.ApiKey);
    } else {
      result = await fetchFromWebscrape(query, envState);
    }
  } catch (err) {
    console.error("[step-04] fetch error:", (err as Error).message);
    result = [];
  }

  return { file, result };
}
