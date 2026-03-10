# Step 03: Build Search Query

## Responsibility
Construct the search query and parameters for a single topic+query pair.

## Inputs
```ts
export interface TopicInput {
  topicName: string;   // e.g. "Claude Code"
  queryName: string;   // e.g. "Ralph Loop"
}
```
- `EnvState` from step 01
- `ResolvedSource` from step 02

## Outputs
```ts
export interface SearchQuery {
  fullQuery: string;          // e.g. "Claude Code Ralph Loop"
  topicSlug: string;          // e.g. "claude-code"
  querySlug: string;          // e.g. "ralph-loop"
  publishedAfter: string;     // ISO 8601 date (now minus lookbackDays)
  maxResults: number;         // from EnvState
  language: string;           // from EnvState
  includeShorts: boolean;     // from EnvState
  sourceUrl: string | null;   // webscrape URL or null if using API
}
```

## Logic
1. Construct `fullQuery = "${topicName} ${queryName}"`
2. Slugify `topicName` and `queryName` (lowercase, spaces → hyphens) for filesystem use
3. Calculate `publishedAfter = currentDate - envState.lookbackDays` in ISO 8601 format
4. If source is `"webscrape"`, build `sourceUrl`:
   ```
   https://www.youtube.com/results?search_query=${encodeURIComponent(fullQuery)}
   ```
5. Return `SearchQuery`

## Notes
- `topicSlug` maps to the directory: `docs/youtube/topic/${topicSlug}/`
- `querySlug` maps to the file: `${querySlug}.json`
- Multiple `TopicInput` objects are processed independently — this step runs once per topic/query pair
