# Step 09: Write Run Manifest

## Responsibility
Write a manifest entry logging the outcome of the research run for a single topic/query pair.

## Inputs
- `SearchQuery` from step 03
- `ResolvedSource` from step 02
- `EnvState` from step 01
- Run statistics collected across all steps

## Output Path
```
docs/youtube/topic/${topicSlug}/manifest.json
```

## Manifest Entry Schema
```ts
export interface ManifestEntry {
  runAt: string;                  // ISO 8601 timestamp
  prompt: string;                 // the raw prompt/request that triggered this run
  topicName: string;
  queryName: string;
  fullQuery: string;
  dataSource: DataSource;         // "youtube-api" | "tavily" | "webscrape"
  publishedAfter: string;         // lookback window start
  maxResults: number;
  language: string;
  includeShorts: boolean;
  fetched: number;                // raw count from step 04
  afterDateFilter: number;        // count after step 05
  afterLanguageFilter: number;    // count after step 06
  afterShortsFilter: number;      // count after step 07
  newVideosSaved: number;         // count from step 08 (deduplicated)
  excluded: ExcludedEntry[];      // videos excluded with reasons
  errors: string[];               // any non-fatal errors during the run
  // Recommendation phase (steps 10–12) — null if recommendation phase did not run
  recommendation: RecommendationStats | null;
}

export interface RecommendationStats {
  cachedCount: number;            // videos skipped because a recommendation already existed (step 10 pre-check)
  transcriptsFetched: number;     // videos where transcript was available
  transcriptsMissing: number;     // videos where transcript was unavailable
  totalAnalyzed: number;          // videos sent to LLM for scoring
  watchCount: number;             // videos recommended "watch"
  skipCount: number;              // videos recommended "skip"
  highConfidence: number;         // recommendations with confidence "high"
  mediumConfidence: number;       // recommendations with confidence "medium"
  lowConfidence: number;          // recommendations with confidence "low"
  upserted: number;               // existing recommendations replaced (re-analysis)
  added: number;                  // new recommendations written for first time
}

export interface ExcludedEntry {
  url: string;
  title: string | null;
  reason: "date_out_of_range" | "language_undetectable" | "language_mismatch" | "duplicate";
}
```

## Logic
1. If `manifest.json` does not exist → create it with `{ runs: [] }`
2. Read existing file
3. Append the new `ManifestEntry` to the `runs` array
4. Write back to disk

## Notes
- One manifest file per topic slug — all queries under the same topic share the same manifest
- Manifests are append-only and are not deduplicated
- This step runs after step 08 (save results) and again after step 12 (save recommendations) to capture the full run stats
- Set `recommendation: null` when the recommendation phase is skipped (e.g. no API key for LLM, or flag disabled)
