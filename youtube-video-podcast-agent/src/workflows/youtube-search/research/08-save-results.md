# Step 08: Save Results

## Responsibility
Append the mapped `Video[]` results to the topic's JSON file on disk.

## Inputs
- `Video[]` from step 07
- `SearchQuery.topicSlug` and `SearchQuery.querySlug` from step 03

## Output Path Pattern
```
docs/youtube/topic/${topicSlug}/${querySlug}.json
```

Example: topic `Claude Code`, query `Ralph Loop` →
```
docs/youtube/topic/claude-code/ralph-loop.json
```

## File Format
```ts
export interface TopicResultFile {
  topicName: string;
  queryName: string;
  videos: Video[];
}
```

## Logic
1. Ensure directory `docs/youtube/topic/${topicSlug}/` exists (create if not)
2. If `${querySlug}.json` does not exist → create it with `{ topicName, queryName, videos: [] }`
3. Read existing file
4. Deduplicate: filter incoming `Video[]` to exclude any video whose `url` already exists in the file
5. Append new videos to the `videos` array
6. Write the updated file back to disk (pretty-printed JSON)
7. Return count of new videos added

## Notes
- Deduplication is by `url` — this prevents repeat entries across daily cron runs
- Appending to disk is the current persistence strategy; a database migration path will be designed separately
- If write fails, log to run manifest as an error but do not halt the run
