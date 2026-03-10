import { join } from "path";
import { readFileTool } from "../tools/index.mts";
import type { RawVideo } from "../types/index.mts";
import type { ExcludedEntry } from "../types/index.mts";

const specFile = join(import.meta.dirname, "../workflows/youtube-search/research/06-detect-language.md");

// Common English stop words used as a heuristic for language detection
const ENGLISH_STOP_WORDS = new Set([
  "the", "a", "an", "is", "in", "on", "at", "to", "for", "of", "and", "or",
  "it", "this", "that", "with", "as", "by", "are", "was", "be", "has", "had",
  "from", "not", "but", "we", "you", "i", "he", "she", "they", "how", "what",
]);

function detectFromText(title: string, description: string | null): string | null {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const words = text.split(/\W+/).filter((w) => w.length > 1);
  if (!words.length) return null;

  const englishHits = words.filter((w) => ENGLISH_STOP_WORDS.has(w)).length;
  if (englishHits / words.length > 0.05) return "en";

  // Non-Latin script check — if mostly ASCII, it is a Latin-script language
  const latinRatio = [...text].filter((c) => c.charCodeAt(0) < 256).length / text.length;
  if (latinRatio < 0.8) return null; // dominant non-Latin script, can't guess language

  return null;
}

// BCP-47 prefix match: "en-US" matches required language "en"
function languageMatches(resolved: string, required: string): boolean {
  return resolved.toLowerCase().startsWith(required.toLowerCase());
}

export async function detectLanguage(
  videos: RawVideo[],
  requiredLanguage: string,
): Promise<{ file: string; result: RawVideo[]; excluded: ExcludedEntry[] }> {
  const file = await readFileTool.invoke({ file_path: specFile });

  const result: RawVideo[] = [];
  const excluded: ExcludedEntry[] = [];

  for (const video of videos) {
    // Fallback chain: defaultLanguage → defaultAudioLanguage → text heuristic → exclude
    const resolved =
      (video.defaultLanguage?.trim() || null) ??
      (video.defaultAudioLanguage?.trim() || null) ??
      detectFromText(video.title, video.description);

    if (!resolved) {
      excluded.push({ Url: video.url, Title: video.title, Reason: "language_undetectable" });
      continue;
    }

    if (!languageMatches(resolved, requiredLanguage)) {
      excluded.push({ Url: video.url, Title: video.title, Reason: "language_mismatch" });
      continue;
    }

    // Attach resolved language back to the video
    result.push({ ...video, defaultLanguage: resolved });
  }

  return { file, result, excluded };
}
