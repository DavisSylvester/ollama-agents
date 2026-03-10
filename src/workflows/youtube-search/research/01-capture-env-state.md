# Step 01: Capture Environment State

## Responsibility
Read all required environment variables from the OS and build a typed state object. This state is passed to all subsequent steps — no step reads `process.env` directly.

## Inputs
- OS environment (process.env)

## Outputs
```ts
export interface EnvState {
  youtubeApiKey: string | null;        // YOUTUBE_API_KEY
  tavilyApiKey: string | null;         // TAVILY_API_KEY
  webScrapingUsername: string | null;  // WEB_SCRAPING_USERNAME
  webScrapingPassword: string | null;  // WEB_SCRAPING_PASSWORD
  maxResults: number;                  // DEFAULT: 50, MAX: 50 (loop limit)
  lookbackDays: number;                // DEFAULT: 7
  language: string;                    // DEFAULT: "en"
  includeShorts: boolean;              // DEFAULT: true
}
```

## Logic
1. Read `YOUTUBE_API_KEY` from env → set `youtubeApiKey` (null if missing/empty)
2. Read `TAVILY_API_KEY` from env → set `tavilyApiKey` (null if missing/empty)
3. Read `WEB_SCRAPING_USERNAME` from env → set `webScrapingUsername` (null if missing/empty)
4. Read `WEB_SCRAPING_PASSWORD` from env → set `webScrapingPassword` (null if missing/empty)
5. Read `MAX_RESULTS` from env → parse as integer, clamp between 1–50, default 50
6. Read `LOOKBACK_DAYS` from env → parse as integer, default 7
7. Read `LANGUAGE` from env → default `"en"`
8. Read `INCLUDE_SHORTS` from env → parse as boolean, default `true`
9. Return the `EnvState` object

## Notes
- If both API keys are null, the system falls back to webscraping (handled in step 02)
- `webScrapingUsername` / `webScrapingPassword` are passed to `DecodoProxyService` in step 04 (webscrape path only)
- This step never throws — missing values always resolve to documented defaults
