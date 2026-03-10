# Step 02: Resolve Data Source

## Responsibility
Determine which data source to use based on `EnvState`. Returns a resolved source strategy.

## Inputs
- `EnvState` from step 01

## Outputs
```ts
export type DataSource = "youtube-api" | "tavily" | "webscrape";

export interface ResolvedSource {
  source: DataSource;
  apiKey: string | null;
}
```

## Logic (priority order)
1. If `envState.youtubeApiKey` is not null → `{ source: "youtube-api", apiKey: youtubeApiKey }`
2. Else if `envState.tavilyApiKey` is not null → `{ source: "tavily", apiKey: tavilyApiKey }`
3. Else → `{ source: "webscrape", apiKey: null }`

## Notes
- YouTube API is preferred — it returns structured metadata including `defaultLanguage` and `defaultAudioLanguage`
- Tavily is a secondary structured source
- Webscrape is the last-resort fallback using `https://www.youtube.com/results?search_query=${query}`
- The resolved source is logged to the run manifest (step 09)
