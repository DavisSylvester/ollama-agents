# Step 06: Detect Language

## Responsibility
Resolve the language for each video using a fallback chain. Exclude videos whose language cannot be determined.

## Inputs
- `RawVideo[]` from step 05
- `EnvState.language` (the required language, e.g. `"en"`)

## Outputs
- `RawVideo[]` with `defaultLanguage` resolved (never null)
- Videos with unresolvable language are excluded

## Fallback Chain (in order)
1. `defaultLanguage` from video metadata → use if not null/empty
2. `defaultAudioLanguage` from video metadata → use if not null/empty
3. Language detection from `title` + `description` text (using an NLP library or LLM call)
4. Channel default language (requires an additional YouTube API call for `channels.list`)
5. If all fallbacks fail → **exclude** the video, log to run manifest as `excluded_reason: "language_undetectable"`

## Language Matching
- After resolving language, compare to `envState.language`
- BCP 47 prefix match: e.g. `"en-US"` matches `"en"`
- If the resolved language does not match → **exclude** the video, log as `excluded_reason: "language_mismatch"`

## Notes
- Language detection from text (step 3) is a best-effort heuristic and may incur latency
- Channel-level lookup (step 4) is only triggered if steps 1–3 all fail — cache channel results within a run to avoid duplicate API calls
- ISO 639-1 language codes are used throughout (e.g. `"en"`, `"es"`, `"fr"`)
