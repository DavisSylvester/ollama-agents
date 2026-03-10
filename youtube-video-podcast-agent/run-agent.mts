#!/usr/bin/env bun
/**
 * One-shot runner: invokes the full researchGraph pipeline with a prompt
 * Usage: bun run-agent.mts "your search prompt"
 */
import { researchGraph } from "./src/graphs/research-graph.mts";

const prompt = process.argv[2] ?? "Find recent YouTube videos on Claude Code and creating skills";

console.log("=".repeat(72));
console.log(`[runner] Starting YouTube Video Agent`);
console.log(`[runner] Prompt: ${prompt}`);
console.log(`[runner] Date: ${new Date().toISOString()}`);
console.log("=".repeat(72));

try {
  const state = await researchGraph.invoke(
    { prompt },
    {
      callbacks: [
        {
          handleChainStart(chain: unknown, inputs: unknown, runId: string) {
            const name = (chain as { id?: string[] })?.id?.at(-1) ?? "unknown";
            console.log(`\n[graph] ▶ node START: ${name}`);
          },
          handleChainEnd(outputs: unknown, runId: string) {
            // minimal — node name not easily available here
          },
          handleChainError(err: Error) {
            console.error(`[graph] ✖ node ERROR:`, err.message);
          },
        },
      ],
    },
  );

  console.log("\n" + "=".repeat(72));
  console.log("[runner] Pipeline complete. Summary:");
  console.log("=".repeat(72));

  const s = state as Record<string, unknown>;

  if (s["step01Result"]) {
    const env = s["step01Result"] as Record<string, unknown>;
    console.log(`  Lookback days    : ${env["LookbackDays"]}`);
    console.log(`  Max results      : ${env["MaxResults"]}`);
    console.log(`  Language         : ${env["Language"]}`);
  }

  if (s["step03Result"]) {
    const q = s["step03Result"] as Record<string, unknown>;
    console.log(`  Full query       : ${q["FullQuery"]}`);
    console.log(`  Published after  : ${q["PublishedAfter"]}`);
    console.log(`  Topic slug       : ${q["TopicSlug"]}`);
    console.log(`  Query slug       : ${q["QuerySlug"]}`);
  }

  const fetched = (s["step04Result"] as unknown[] | null)?.length ?? 0;
  const afterDate = (s["step05Result"] as unknown[] | null)?.length ?? 0;
  const afterLang = (s["step06Result"] as unknown[] | null)?.length ?? 0;
  const mapped = (s["step07Result"] as unknown[] | null)?.length ?? 0;
  const saved = s["step08Result"] as number | null;

  console.log(`  Fetched          : ${fetched}`);
  console.log(`  After date filter: ${afterDate}`);
  console.log(`  After lang filter: ${afterLang}`);
  console.log(`  After shorts     : ${mapped}`);
  console.log(`  New videos saved : ${saved ?? 0}`);

  const recs = s["step11Result"] as Array<Record<string, unknown>> | null;
  if (recs?.length) {
    console.log(`\n  Recommendations (${recs.length}):`);
    for (const r of recs) {
      console.log(`    [${r["Recommendation"]}] ${r["Title"]}`);
      if (r["Reason"]) console.log(`           Reason: ${r["Reason"]}`);
    }
  }

  const recStats = s["step12Result"] as Record<string, unknown> | null;
  if (recStats) {
    console.log(
      `\n  Rec stats: ${recStats["TotalAnalyzed"]} analyzed, ${recStats["WatchCount"]} watch, ${recStats["SkipCount"]} skip`,
    );
  }

  const errors = s["errors"] as string[];
  if (errors?.length) {
    console.log(`\n  Errors (${errors.length}):`);
    for (const e of errors) console.log(`    - ${e}`);
  }

  console.log("=".repeat(72));
  console.log("[runner] Done.");
} catch (err) {
  console.error("[runner] Fatal error:", (err as Error).message);
  process.exit(1);
}
