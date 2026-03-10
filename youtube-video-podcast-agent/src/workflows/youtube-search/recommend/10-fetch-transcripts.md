# Step 10: Fetch Transcripts

## Responsibility
Fetch transcripts for each saved video using HTTP scraping — **not** the YouTube Captions API — to preserve quota budget. Attach transcript text to each video for analysis in step 11.

## Inputs
- `Video[]` from step 08 (saved to disk)
- `EnvState` from step 01
- Existing `RecommendationFile` from `${querySlug}.recommendations.json` (if present) — used to detect already-analyzed videos

## Outputs
```ts
export interface VideoWithTranscript {
  video: Video;
  transcript: string | null;    // full plain-text transcript, null if unavailable
  transcriptSource: TranscriptSource | null;
}

export type TranscriptSource = "timedtext-api" | "ytInitialPlayerResponse";

export interface TranscriptFetchResult {
  toAnalyze: VideoWithTranscript[];   // videos that need LLM analysis in step 11
  cachedCount: number;                // videos skipped because a recommendation already exists
}
```

## Logic

### Pre-check: Skip Already-Analyzed Videos
Before fetching any transcripts, load `${querySlug}.recommendations.json` if it exists:
1. Build a `Set<string>` of `url` values from `recommendations[]` in the file
2. Partition the input `Video[]` into two groups:
   - **cached**: videos whose `url` is already in the set → skip entirely, do NOT fetch transcript
   - **pending**: videos whose `url` is not in the set → proceed to transcript fetch below
3. Log `cachedCount = cached.length` — this will be reported in step 09's `RecommendationStats`
4. If all videos are cached, return `{ toAnalyze: [], cachedCount }` immediately and skip the rest of this step

### Transcript Fetch (pending videos only)

### Primary: YouTube Timedtext Endpoint (no API key required)
1. For each `Video`, extract the video ID from `video.url`
2. Fetch `https://www.youtube.com/watch?v={videoId}` (plain GET, no proxy required for most regions)
3. Extract the `ytInitialPlayerResponse` JSON blob from the HTML
4. Locate `captions.playerCaptionsTracklistRenderer.captionTracks[]`
5. Select the best track matching `EnvState.language` (BCP 47 prefix match); fall back to first available track
6. Fetch the track's `baseUrl` — this returns a timed-text XML response
7. Strip XML tags, decode HTML entities, concatenate all `<text>` node content into a single plain-text string
8. Set `transcriptSource: "timedtext-api"`

### Fallback: ytInitialPlayerResponse transcript
- If caption tracks are absent (auto-captions disabled), check `engagementPanels` for transcript panel data
- If found, extract and flatten segment text
- Set `transcriptSource: "ytInitialPlayerResponse"`

### No Transcript Available
- If both strategies fail, set `transcript: null`, `transcriptSource: null`
- Log the video URL to the run manifest under `errors[]` with message `"transcript_unavailable"`
- Continue processing remaining videos — do not halt the run

## Quota Impact
- **Zero YouTube API quota units consumed** — all fetches are plain HTTP GETs
- Optional: use `EnvState.webScrapingUsername` / `webScrapingPassword` with `DecodoProxyService` if rate-limited

## Notes
- Transcript text is not persisted to disk — it is passed in-memory to step 11
- Strip timestamps, speaker labels, and `[Music]`/`[Applause]` annotations before passing to step 11
- Cap transcript length at 50,000 characters to bound LLM token cost in step 11
- `cachedCount` is passed to step 09 so `RecommendationStats.cachedCount` can be recorded in the manifest
- Implementation: `src/services/transcripts/TranscriptFetcher.ts`
