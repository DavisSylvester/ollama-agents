import { join } from "path";
import { z } from "zod";
import { readFileTool } from "../tools/index.mts";
import { ollamaModel } from "../models/index.mts";
import type { EnvState } from "../types/index.mts";
import type { ResolvedSource } from "../types/index.mts";
import type { SearchQuery } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/03-build-search-query.md");

const topicQuerySchema = z.object({
  topicName: z.string().describe("Primary topic to search for, e.g. 'Claude Code'"),
  queryName: z.string().describe("Secondary search term or modifier, e.g. 'Ralph Loop'"),
});

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function buildSearchQuery(
  prompt: string,
  envState: EnvState,
  resolvedSource: ResolvedSource,
): Promise<{ file: string; result: SearchQuery }> {
  const [file, parsed] = await Promise.all([
    readFileTool.invoke({ file_path: specFile }),
    ollamaModel.withStructuredOutput(topicQuerySchema).invoke([
      {
        role: "system",
        content:
          "Extract the primary topic and secondary query term from the user prompt. " +
          "Return them as JSON with topicName and queryName fields. " +
          "If there is only one topic, use it as topicName and set queryName to 'general'.",
      },
      { role: "user", content: prompt },
    ]),
  ]);

  const { topicName, queryName } = parsed as z.infer<typeof topicQuerySchema>;
  const fullQuery = `${topicName} ${queryName}`.trim();
  const topicSlug = slugify(topicName) || "general";
  const querySlug = slugify(queryName) || "general";

  const publishedAfter = new Date(Date.now() - envState.LookbackDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;

  const sourceUrl =
    resolvedSource.Source === "webscrape"
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(fullQuery)}`
      : null;

  const result: SearchQuery = {
    FullQuery: fullQuery,
    TopicSlug: topicSlug,
    QuerySlug: querySlug,
    PublishedAfter: publishedAfter,
    MaxResults: envState.MaxResults,
    Language: envState.Language,
    IncludeShorts: envState.IncludeShorts,
    SourceUrl: sourceUrl,
  };

  return { file, result };
}
