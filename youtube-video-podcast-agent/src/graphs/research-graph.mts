import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { join } from "path";
import { readFileTool } from "../tools/index.mts";
import {
  captureEnvState,
  resolveDataSource,
  buildSearchQuery,
  fetchVideos,
  filterByDate,
  detectLanguage,
  mapToVideoInterface,
  saveResults,
  writeRunManifest,
} from "../nodes/index.mts";
import type { RunStats } from "../nodes/index.mts";
import type { EnvState } from "../types/env-state.mts";
import type { ResolvedSource } from "../types/resolved-source.mts";
import type { SearchQuery } from "../types/search-query.mts";
import type { RawVideo } from "../types/raw-video.mts";
import type { MappedVideo } from "../types/mapped-video.mts";
import type { ManifestEntry } from "../types/manifest-entry.mts";
import type { ExcludedEntry } from "../types/manifest-entry.mts";

const researchDir = join(import.meta.dirname, "../workflows/youtube-search/research");

const researchFiles = [
  "01-capture-env-state.md",
  "02-resolve-data-source.md",
  "03-build-search-query.md",
  "04-fetch-videos.md",
  "05-filter-by-date.md",
  "06-detect-language.md",
  "07-map-to-video-interface.md",
  "08-save-results.md",
  "09-write-run-manifest.md",
] as const;

type ResearchFile = (typeof researchFiles)[number];

export interface ResearchFileEntry {
  name: ResearchFile;
  content: string;
}

// Identity reducer — last write wins (suited for single-step result slots)
const lastWrite = <T,>(current: T, update: T): T => update ?? current;

const ResearchState = Annotation.Root({
  prompt: Annotation<string>({ reducer: lastWrite, default: () => "" }),
  files: Annotation<ResearchFileEntry[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  // Accumulated excluded entries and errors across all steps
  excluded: Annotation<ExcludedEntry[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  step01Result: Annotation<EnvState | null>({ reducer: lastWrite, default: () => null }),
  step02Result: Annotation<ResolvedSource | null>({ reducer: lastWrite, default: () => null }),
  step03Result: Annotation<SearchQuery | null>({ reducer: lastWrite, default: () => null }),
  step04Result: Annotation<RawVideo[] | null>({ reducer: lastWrite, default: () => null }),
  step05Result: Annotation<RawVideo[] | null>({ reducer: lastWrite, default: () => null }),
  step06Result: Annotation<RawVideo[] | null>({ reducer: lastWrite, default: () => null }),
  step07Result: Annotation<MappedVideo[] | null>({ reducer: lastWrite, default: () => null }),
  step08Result: Annotation<number | null>({ reducer: lastWrite, default: () => null }),
  step09Result: Annotation<ManifestEntry | null>({ reducer: lastWrite, default: () => null }),
});

type State = typeof ResearchState.State;
type Update = typeof ResearchState.Update;

// Fallback: reads only the spec file (used if a step has no real impl yet)
function makeReadNode(fileName: ResearchFile) {
  return async (): Promise<Update> => {
    const filePath = join(researchDir, fileName);
    const content = await readFileTool.invoke({ file_path: filePath });
    return { files: [{ name: fileName, content }] };
  };
}

const builder = new StateGraph(ResearchState);

builder.addNode("01-capture-env-state", async (): Promise<Update> => {
  const { file, result } = await captureEnvState();
  return {
    files: [{ name: "01-capture-env-state.md", content: file }],
    step01Result: result,
  };
});

builder.addNode("02-resolve-data-source", async (state: State): Promise<Update> => {
  if (!state.step01Result) return makeReadNode("02-resolve-data-source.md")();
  const { file, result } = await resolveDataSource(state.step01Result);
  return {
    files: [{ name: "02-resolve-data-source.md", content: file }],
    step02Result: result,
  };
});

builder.addNode("03-build-search-query", async (state: State): Promise<Update> => {
  if (!state.step01Result || !state.step02Result) return makeReadNode("03-build-search-query.md")();
  const { file, result } = await buildSearchQuery(
    state.prompt,
    state.step01Result,
    state.step02Result,
  );
  return {
    files: [{ name: "03-build-search-query.md", content: file }],
    step03Result: result,
  };
});

builder.addNode("04-fetch-videos", async (state: State): Promise<Update> => {
  if (!state.step02Result || !state.step03Result || !state.step01Result) {
    return makeReadNode("04-fetch-videos.md")();
  }
  let result: RawVideo[] = [];
  const errors: string[] = [];
  try {
    ({ result } = await fetchVideos(state.step03Result, state.step02Result, state.step01Result));
  } catch (err) {
    errors.push(`step-04: ${(err as Error).message}`);
  }
  const file = await readFileTool.invoke({ file_path: join(researchDir, "04-fetch-videos.md") });
  return {
    files: [{ name: "04-fetch-videos.md", content: file }],
    step04Result: result,
    errors,
  };
});

builder.addNode("05-filter-by-date", async (state: State): Promise<Update> => {
  if (!state.step04Result || !state.step03Result) return makeReadNode("05-filter-by-date.md")();
  const { file, result, excluded } = await filterByDate(
    state.step04Result,
    state.step03Result.PublishedAfter,
  );
  return {
    files: [{ name: "05-filter-by-date.md", content: file }],
    step05Result: result,
    excluded,
  };
});

builder.addNode("06-detect-language", async (state: State): Promise<Update> => {
  if (!state.step05Result || !state.step01Result) return makeReadNode("06-detect-language.md")();
  const { file, result, excluded } = await detectLanguage(
    state.step05Result,
    state.step01Result.Language,
  );
  return {
    files: [{ name: "06-detect-language.md", content: file }],
    step06Result: result,
    excluded,
  };
});

builder.addNode("07-map-to-video-interface", async (state: State): Promise<Update> => {
  if (!state.step06Result || !state.step01Result) {
    return makeReadNode("07-map-to-video-interface.md")();
  }
  const { file, result } = await mapToVideoInterface(
    state.step06Result,
    state.step01Result.IncludeShorts,
  );
  return {
    files: [{ name: "07-map-to-video-interface.md", content: file }],
    step07Result: result,
  };
});

builder.addNode("08-save-results", async (state: State): Promise<Update> => {
  if (!state.step07Result || !state.step03Result) return makeReadNode("08-save-results.md")();
  const { file, result } = await saveResults(state.step07Result, state.step03Result);
  return {
    files: [{ name: "08-save-results.md", content: file }],
    step08Result: result,
  };
});

builder.addNode("09-write-run-manifest", async (state: State): Promise<Update> => {
  if (!state.step03Result || !state.step02Result || !state.step01Result) {
    return makeReadNode("09-write-run-manifest.md")();
  }

  const stats: RunStats = {
    prompt: state.prompt,
    fetched: state.step04Result?.length ?? 0,
    afterDateFilter: state.step05Result?.length ?? 0,
    afterLanguageFilter: state.step06Result?.length ?? 0,
    afterShortsFilter: state.step07Result?.length ?? 0,
    newVideosSaved: state.step08Result ?? 0,
    excluded: state.excluded,
    errors: state.errors,
  };

  const { file, result } = await writeRunManifest(
    state.step03Result,
    state.step02Result,
    state.step01Result,
    stats,
  );

  return {
    files: [{ name: "09-write-run-manifest.md", content: file }],
    step09Result: result,
  };
});

const nodeNames = researchFiles.map((f) => f.replace(".md", ""));

// Chain nodes in order: START -> 01 -> 02 -> ... -> 09 -> END
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b = builder as any;
b.addEdge(START, nodeNames[0]);
for (let i = 0; i < nodeNames.length - 1; i++) {
  b.addEdge(nodeNames[i], nodeNames[i + 1]);
}
b.addEdge(nodeNames[nodeNames.length - 1], END);

export const researchGraph = builder.compile();
