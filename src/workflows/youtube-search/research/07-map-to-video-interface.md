# Step 07: Map to Video Interface

## Responsibility
Transform resolved `RawVideo` objects to the canonical `Video` interface. Apply the Shorts inclusion/exclusion rule.

## Inputs
- `RawVideo[]` from step 06 (language-resolved)
- `EnvState.includeShorts`

## Outputs
```ts
export interface Video {
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string;        // ISO 8601
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  isShort: number;            // 0 = regular video, 1 = Short
  defaultLanguage: string;    // always resolved (never null at this point)
}
```

## Logic
1. If `envState.includeShorts === false`, filter out any `RawVideo` where `isShort === true`
2. For each remaining `RawVideo`, map fields:
   - `isShort`: `rawVideo.isShort ? 1 : 0`
   - `defaultLanguage`: resolved language from step 06
   - All other fields: direct mapping from `RawVideo`
3. Return `Video[]`

## Notes
- `isShort` is stored as a number (0/1) per the Video interface — suitable for future database storage
- No data is dropped silently here; all exclusions were handled in steps 05 and 06
