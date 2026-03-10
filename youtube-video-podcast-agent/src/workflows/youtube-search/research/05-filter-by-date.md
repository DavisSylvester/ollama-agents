# Step 05: Filter by Date

## Responsibility
Filter raw video results to only include videos published within the lookback window.

## Inputs
- `RawVideo[]` from step 04
- `SearchQuery.publishedAfter` from step 03

## Outputs
- `RawVideo[]` — filtered list

## Logic
1. Parse each video's `publishedAt` as a date
2. Reject any video where `publishedAt < publishedAfter`
3. If `publishedAt` is null or unparseable, exclude the video and log to the run manifest
4. Return the filtered array

## Notes
- The YouTube API `publishedAfter` param already filters at the API level, but this step acts as a defense layer for Tavily and webscrape sources where date filtering is not guaranteed
- Date comparisons use UTC
