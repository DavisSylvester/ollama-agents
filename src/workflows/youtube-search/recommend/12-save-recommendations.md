# Step 12: Save Recommendations

## Responsibility
Persist `VideoRecommendation[]` to disk alongside the topic's video results, and append recommendation statistics to the run manifest.

## Inputs
- `VideoRecommendation[]` from step 11
- `SearchQuery.topicSlug` and `SearchQuery.querySlug` from step 03

## Output Path Pattern
```
docs/youtube/topic/${topicSlug}/${querySlug}.recommendations.json
```

Example: topic `Claude Code`, query `Ralph Loop` →
```
docs/youtube/topic/claude-code/ralph-loop.recommendations.json
```

## File Format
```ts
export interface RecommendationFile {
  topicName: string;
  queryName: string;
  generatedAt: string;          // ISO 8601 timestamp of this run
  recommendations: VideoRecommendation[];
}
```

## Logic
1. Ensure directory `docs/youtube/topic/${topicSlug}/` exists (will already exist after step 08)
2. If `${querySlug}.recommendations.json` does not exist → create it with `{ topicName, queryName, generatedAt, recommendations: [] }`
3. Read existing file
4. Upsert by `url`: for any incoming recommendation whose `url` already exists, **replace** the existing entry (re-analysis always wins)
5. Append any new recommendations (urls not previously seen)
6. Sort final array: `watch` first, then by `relevanceScore` descending
7. Write updated file back to disk (pretty-printed JSON)
8. Return summary stats: `{ watched: number, skipped: number, upserted: number, added: number, cachedCount: number }`

## Notes
- Videos detected as already-analyzed in step 10 are **not** passed to step 11 or 12 at all — their existing recommendations remain untouched
- Unlike `08-save-results.md` which appends and deduplicates, recommendations **upsert** — a re-run replaces stale scores with fresh analysis for videos that are explicitly re-analyzed
- The sorted order makes the file immediately human-readable without further processing
- If write fails, log to run manifest as an error but do not halt
- Implementation: `src/services/recommend/RecommendationWriter.ts`
