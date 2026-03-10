# Step 04: Fetch Videos

## Responsibility
Execute the search against the resolved data source and return raw video results.

## Inputs
- `SearchQuery` from step 03
- `ResolvedSource` from step 02

## Outputs
```ts
export interface RawVideo {
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string;          // ISO 8601
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  isShort: boolean;             // raw boolean, mapped to 0/1 in step 07
}
```

## Logic by Source

### youtube-api
- Call `GET https://www.googleapis.com/youtube/v3/search`
  - `q`: `searchQuery.fullQuery`
  - `type`: `video`
  - `publishedAfter`: `searchQuery.publishedAfter`
  - `maxResults`: `searchQuery.maxResults`
  - `relevanceLanguage`: `searchQuery.language`
  - `key`: `resolvedSource.apiKey`
- For each result, fetch video details via `videos.list` to get `defaultLanguage`, `defaultAudioLanguage`, and video duration (to detect Shorts: duration ≤ 60s)

### tavily
- Call Tavily search API with `query: searchQuery.fullQuery`
- Filter results to `youtube.com/watch` URLs only
- Extract available metadata from Tavily result fields

### webscrape
- A `DecodoProxyService` is injected into `WebscrapeFetcher` via constructor DI
  - Proxy credentials come from `EnvState.webScrapingUsername` / `webScrapingPassword`
  - Proxy host: `gate.decodo.com`, ports 10001–10007 (round-robin)
  - If credentials are absent, a direct fetch is attempted with a warning logged
- Fetch `searchQuery.sourceUrl` via Bun's `fetch` with `{ proxy: proxyUrl }` option
- Extract `var ytInitialData = {...};` JSON blob from raw HTML (server-rendered, no JS execution needed)
- Walk `contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[].itemSectionRenderer.contents[].videoRenderer`
- Per `videoRenderer`: extract title, channelId, channelTitle, publishedAt (from relative date string), description snippet, thumbnail, isShort
- Note: `defaultLanguage` and `defaultAudioLanguage` will be null — resolved in step 06

## Notes
- If the API call fails (rate limit, network error), log the error to the run manifest and return an empty array — do not throw
- Shorts detection via YouTube API: `contentDetails.duration` parsed as ISO 8601 duration ≤ PT60S
- Webscrape Shorts detection: URL contains `/shorts/` or `badges[].label === "Shorts"`
- Webscrape relative dates ("3 days ago") are estimated with a +1 day buffer; step 05 is the authoritative date filter
- Implementation: `src/services/fetchers/WebscrapeFetcher.ts` | proxy: `src/services/proxy/DecodoProxyService.ts`
