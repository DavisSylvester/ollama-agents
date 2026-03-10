# Step 11: Analyze and Recommend

## Responsibility
Analyze each video's transcript (and metadata) against the user's topic interests and produce a structured watch/skip recommendation.

## Inputs
- `TranscriptFetchResult.toAnalyze` (`VideoWithTranscript[]`) from step 10 — only videos that are **not** already in the recommendations file
- `SearchQuery.topicName` and `SearchQuery.queryName` from step 03
- `EnvState` from step 01

## Outputs
```ts
export interface VideoRecommendation {
  url: string;
  title: string;
  recommendation: "watch" | "skip";
  confidence: "high" | "medium" | "low";
  relevanceScore: number;       // 0–100
  summary: string;              // 2–3 sentences: what the video covers
  reasons: string[];            // bullet points justifying the recommendation
  transcriptAvailable: boolean;
  analyzedAt: string;           // ISO 8601
}
```

## Logic

### Per Video
1. Build an analysis prompt containing:
   - The topic name and query name (to establish the user's intent)
   - Video title, channel, published date, description
   - Transcript text (if available); otherwise metadata only
2. Call the LLM (Claude) with the prompt — see **Prompt Template** below
3. Parse the structured JSON response into a `VideoRecommendation`
4. If the LLM call fails (timeout, parse error), set:
   - `recommendation: "skip"`, `confidence: "low"`, `relevanceScore: 0`
   - `reasons: ["analysis_failed"]`
   - Log the error to the run manifest

### Confidence Rules
| Condition | Confidence |
|-----------|------------|
| Transcript available + relevanceScore ≥ 70 | `high` |
| Transcript available + relevanceScore 40–69 | `medium` |
| No transcript, metadata only | `low` |
| relevanceScore < 40 (any) | `low` |

### Recommendation Rules
| relevanceScore | recommendation |
|---------------|----------------|
| ≥ 60 | `watch` |
| < 60 | `skip` |

## Prompt Template
```
You are a video recommendation assistant. Given the topic a user cares about and a YouTube video, determine whether the user should watch it.

Topic: {topicName}
Query: {queryName}

Video Metadata:
- Title: {title}
- Channel: {channelTitle}
- Published: {publishedAt}
- Description: {description}

{transcriptSection}

Return a JSON object with this exact shape:
{
  "relevanceScore": <0–100 integer>,
  "summary": "<2–3 sentence summary of what the video covers>",
  "reasons": ["<reason 1>", "<reason 2>", ...]
}

Scoring guide:
- 80–100: Directly and substantially covers the topic
- 60–79: Relevant, useful context or related subtopic
- 40–59: Tangentially related, limited direct value
- 0–39: Off-topic or not useful for this topic
```

Where `{transcriptSection}` is either:
- `Transcript:\n{transcriptText}` if available
- `Transcript: not available — analysis based on metadata only` if null

## Notes
- LLM model: use the most capable available Claude model (e.g. `claude-opus-4-6`)
- Temperature: 0 (deterministic scoring)
- Max tokens: 512 (response is structured JSON, not prose)
- Process videos sequentially to control API rate; a configurable concurrency limit (default: 3) may be added later
- Implementation: `src/services/recommend/RecommendationAnalyzer.ts`
