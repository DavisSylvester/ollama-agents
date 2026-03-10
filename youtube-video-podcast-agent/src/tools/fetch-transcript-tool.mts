import { tool } from "@langchain/core/tools";
import { z } from "zod";

function extractVideoId(url: string): string | null {
  const match = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?]+)/);
  return match?.[1] ?? null;
}

// Strip XML/HTML tags, decode common HTML entities, remove annotation brackets
function cleanTranscriptText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const fetchTranscriptTool = tool(
  async ({ url, language }): Promise<string> => {
    const videoId = extractVideoId(url);
    if (!videoId) return `Error: could not extract video ID from "${url}"`;

    let html: string;
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "Accept-Language": `${language},en;q=0.9` },
      });
      if (!pageRes.ok) return `Error: failed to fetch video page — ${pageRes.status}`;
      html = await pageRes.text();
    } catch (err) {
      return `Error: network error fetching video page — ${(err as Error).message}`;
    }

    // Extract ytInitialPlayerResponse from the page HTML
    const prMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var |<\/script>)/s);
    if (!prMatch) return `Error: ytInitialPlayerResponse not found in page`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let playerData: any;
    try {
      playerData = JSON.parse(prMatch[1]!);
    } catch {
      return `Error: failed to parse ytInitialPlayerResponse JSON`;
    }

    const captionTracks: Array<{ languageCode: string; baseUrl: string }> =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    if (!captionTracks.length) return `Error: no caption tracks available for this video`;

    // Prefer a track matching the requested language (BCP-47 prefix), fallback to first
    const track =
      captionTracks.find((t) => t.languageCode?.startsWith(language)) ?? captionTracks[0];

    if (!track?.baseUrl) return `Error: selected caption track has no baseUrl`;

    // Fetch timed-text in JSON format
    let ttText: string;
    try {
      const ttRes = await fetch(`${track.baseUrl}&fmt=json3`);
      if (!ttRes.ok) return `Error: timedtext fetch failed — ${ttRes.status}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ttData = (await ttRes.json()) as any;
      ttText = (ttData.events ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((e: any) => e.segs ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => s.utf8 ?? "")
        .join(" ");
    } catch (err) {
      return `Error: failed to fetch or parse timedtext — ${(err as Error).message}`;
    }

    const cleaned = cleanTranscriptText(ttText);
    if (!cleaned) return `Error: transcript text was empty after cleaning`;

    // Cap at 50 000 chars to bound LLM token cost in step 11
    return cleaned.length > 50_000 ? cleaned.slice(0, 50_000) : cleaned;
  },
  {
    name: "fetch_transcript",
    description:
      "Fetch the plain-text transcript for a YouTube video using the timedtext endpoint. " +
      "Returns the transcript as a string, or an error message prefixed with 'Error:'.",
    schema: z.object({
      url: z.string().describe("Full YouTube watch URL, e.g. https://www.youtube.com/watch?v=..."),
      language: z.string().default("en").describe("Preferred BCP-47 language code, e.g. 'en'"),
    }),
  },
);
